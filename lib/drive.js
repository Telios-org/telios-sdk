const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const MultiHyperbee = require('multi-hyperbee');
const pump = require('pump');
const hyperswarm = require('hyperswarm');
const sodium = require('sodium-native');
const Crypto = require('./crypto');
const chokidar = require('chokidar');
const p2plex = require('p2plex');
const Hyperbeam = require('hyperbeam');
const MemoryStream = require('memorystream');

class Drive extends EventEmitter {
  constructor(drivePath, publicKey, { keyPair, ignore, live, watch, peers, network }) {
    super();

    this.create = false;
    this.isClone = false;
    this.keyPair = keyPair;
    this.publicKey = publicKey; // Key used to clone and seed drive. Should only be shared with trusted sources
    this.discoveryKey = null; // Key to be shared publicly to connect with peers hosting the shared drive
    this.live = live; // If true this will connect the drive to the network
    this.watch = watch; // If true watch for updates to local drive and write those updates to the DB
    this.readyToWatch = false; // Don't watch while drive is being initialized
    this.peers = peers; // Other peers' diff feed keys for replication
    this.metaPath = drivePath + '/.drive'; // Path where drive metadata
    this.drivePath = drivePath; // Path of files to be shared
    this.ignore = ignore; // File pattern to ignore in drivePath
    this.db = null; // Peer DB
    this.diffFeedKey = null; // Diff DB feed key
    this.network = network;
    this.plex = null;
    this.watcher = null // Directory watcher
    this.memStream = null;
    this.stream = null;
    this.swarm = null;
    this.diffHyperbee = null;
    this.incomingFiles = {};
    this.connections = [];

    if(!fs.existsSync(drivePath)) {
      fs.mkdirSync(drivePath);
      fs.mkdirSync(drivePath + '/.drive');
      this.create = true;
    }

    // If there aren't any Hyperbee DBs then bootstrap new drive
    if(fs.existsSync(path.join(drivePath, '/.drive')) && 
      !fs.existsSync(path.join(drivePath,'/.drive/db')) || 
      !fs.existsSync(path.join(drivePath,'/.drive/db_diff'))
    ) {
      this.create = true;
    }
  }

  async ready() {
    this.db = new MultiHyperbee(`${this.metaPath}/db`, { keyEncoding: 'utf-8', valueEncoding: 'json' });
    this.diffHyperbee = await this.db.getDiff();
    this.diffFeedKey = this.diffHyperbee.feed.key.toString('hex');

    await this.db.ready();

    if (this.create && !this.publicKey) {
      // Create and bootstrap new drive
      await this._create();
    }

    if(this.create && this.publicKey) {
      // Create a clone from existing remote drive
      await this._cloneRemoteDrive();
      this.isClone = true;
    }

    if(!this.create) {
      // Reconnect existing drive
      const publicKey = await this.db.get('publicKey');
      this.publicKey = publicKey.value.key;
    }

    if (this.live) {
      // DB Replication
      this._startSwarm({
        db: this.db,
        topic: this.publicKey,
        lookup: true,
        announce: true,
      });

      this._connectToPublicTopic({ announce: true, lookup: false });
    }

    this.readyToWatch = true;

    if (this.watch) {
      this._watchDrive(this.drivePath);
    }
  }

  async _create() {
    let pubKeyBuf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
  
    sodium.randombytes_buf(pubKeyBuf);
  
    this.publicKey = pubKeyBuf.toString('hex');

    // TODO: Setup access control
    // const accessList = {
    //   admin: null,
    //   read: null,
    //   write: null,
    //   seed: null
    // }
  
    await this.db.put('owner', { key: this.keyPair.publicKey.toString('hex') });
    console.log('Owner ', this.keyPair.publicKey.toString('hex'));
    
    await this.db.put('publicKey', { key: this.publicKey });
    console.log('Drive public key ', this.publicKey);

    const files = fs.readdirSync(this.drivePath);
    await this._initDir(files); // Load all file metadata into Hyperbee DB
    this.readyToWatch = true;
  }

  // Clone a remote drive
  async _cloneRemoteDrive() {
    if(this.peers) {
      const writeList = [];

      for (let i = 0; i < this.peers.length; i++) {
        if(this.peers[i].access.indexOf('write') !== -1) {
          writeList.push(this.peers[i].diffKey); // Sync updates from peers
          await this.db.addPeer(this.peers[i].diffKey);
        }
      }

      await this.db.put('canWrite', { peers: writeList });
    }
  }

  _connectToPublicTopic({ announce, lookup }) {
    this.plex = p2plex();
    const topic = createTopicHash(this.publicKey);
    this.connections.push(this.plex.publicKey.toString('hex'));

    console.log('Drive discovery key ', topic.toString('hex'));
    
    this.plex.on('connection', peer => {
      if(this.connections.indexOf(peer.publicKey.toString('hex')) === -1) {
        
        console.log('Peer connected', peer.publicKey.toString('hex'));
        // const stream = peer.createStream('request');
        // pump(this.memStream, stream, (err) => {
        //   console.log(err);
        // })

        
        //console.log(reqStream);
        //this.memStream.pipe(reqStream);
        const rs = peer.receiveStream('request');

        // const stream = pump(this.memStream, reqStream, (err) => {
        //   console.log(err);
        // })

        rs.on('data', data => {
          console.log('Serve file ', data.toString('utf8'))
          this._serveFile(data.toString('utf8'), peer.publicKey.toString('hex'));
        });

        peer.on('disconnected', peer => {
          rs.end();
        });
      }
    });
    
    this.plex.join(topic, { announce, lookup });
  }

  // Watch for file changes on the drive
  _watchDrive() {
    // Initialize local watcher.
    this.watcher = chokidar.watch(this.drivePath, {
      ignored: this.ignore ? this.ignore : /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      cwd: this.drivePath
      // awaitWriteFinish: {
      //   stabilityThreshold: 2000,
      //   pollInterval: 500
      // }
    });

    this.watcher
      .on('add', path => {
        this.emit('add', `File ${path} has been added`)
        // console.log(`File ${path} has been added`)
      })
      .on('change', async (filename) => {
        if(this.incomingFiles[filename]) return;

        const fullPath = path.join(this.drivePath, filename);
        // Check if file is already in DB
        const stats = fs.statSync(fullPath);

        if(!stats.isDirectory()) {
          const hash = await checksumFile('sha256', fullPath);
          const file = await this.db.get(filename);

          if(file.value.hash !== hash) {
            await this.db.put(filename, {
              hash
            });
            await this.db.put(hash, {
              filename,
              hash,
              path: '/',
              size: stats.size,
            });

            console.log(`${file.key} has been updated on ${this.drivePath}`);
          }
        }
      });
    
    // this.watcher
    //   .on('raw', async (event, path, details) => { // internal
    //     console.log(`${event} : ${path} : ${this.drivePath}`);
    //     if(event === 'change') {
    //       // Check if file is already in DB
    //       const stats = fs.statSync(`${details.watchedPath}`);

    //       if(!stats.isDirectory()) {
    //         const hash = await checksumFile('sha256', `${details.watchedPath}`);
    //         const file = await this.db.get(path);

    //         if(file.value.hash !== hash) {

    //           // await this.db.put(path, {
    //           //   hash
    //           // });
    //           // await this.db.put(hash, {
    //           //   filename: path,
    //           //   hash,
    //           //   path: '/',
    //           //   size: stats.size,
    //           // });

    //           console.log(`${file.key} has been updated!`);
    //         }
    //       }
    //     }
    //   });

    // Watch for remote changes
    this.stream = this.db.createHistoryStream({ live: true, gte: -1 });
    this.memStream = new MemoryStream();

    this.stream.on('data', async data => {
      if(data.key === 'publicKey') {
        this.publicKey = data.value.key;
      }

      if (data.value.filename && this.readyToWatch) {
        try {
        const updateFile = await this._fileNeedsUpdate(data.value);

          if(updateFile) {

            console.log(`Updating Local File ${data.value.filename} on ${this.drivePath}`);
            this.incomingFiles[data.value.filename] = true;

            const plex = p2plex();
            const topic = createTopicHash(this.publicKey);
            this.connections.push(plex.publicKey.toString('hex'));

            console.log(this.connections)

            const ws = fs.createWriteStream(`${this.drivePath}/${data.value.filename}`);
            const beam = new Hyperbeam(`${plex.publicKey.toString('hex')}.${data.value.hash}`);
            
            pump(beam, ws, (err) => {
              if(err) console.log(err);
              // Beam is now closed
              plex.destroy();
              console.log('Beam closed!')

              // Yuck
              setTimeout(() => {
                delete this.incomingFiles[data.value.filename];
              }, 300);
            });

            plex.on('connection', peer => {
              if(this.connections.indexOf(peer.publicKey.toString('hex')) === -1) {
                peer.createStream('request').end(data.value.hash);
              }
            });

            plex.join(topic, { announce: false, lookup: true });
          }
        } catch(err) {
          console.log(err);
          throw err;
        }
      }
    });
  }

  // Close drive and disconnect from Hyperswarm
  async close() {
    this._closeSwarm({ topic: this.publicKey });
    this.memStream.end();
    this.stream.destroy();

    if(this.db.feed.opened) {
      this.db.feed.close();
    }

    if(this.diffHyperbee.feed.opened) {
      this.diffHyperbee.feed.close();
    }

    this.plex.destroy();
  }

  async _serveFile(hash, peer) {
    const file = await this.db.get(hash);
    const rs = fs.createReadStream(`${this.drivePath}/${file.value.filename}`);
    
    const beam = new Hyperbeam(`${peer}.${hash}`);
    console.log(`Beam ${peer}.${hash}`)
    console.log(' ')
    pump(rs, beam, (err) => {
      if (err) throw err;
    });
  }

  async _fileNeedsUpdate(file) {
    // const localFile = await this.db.get(file.filename);
    // console.log(localFile);
    // console.log(file);
    // console.log('.....................................................');
    // if(!localFile || localFile && localFile.value.hash !== file.hash) return true;
    // return false;

    return new Promise((resolve, reject) => {
      const filePath = path.join(this.drivePath, file.path, file.filename);
      if(!fs.existsSync(filePath)) return resolve(true);
      
      checksumFile('sha256', filePath)
        .then(async hash => {
          if(hash !== file.hash) {
            return resolve(true);
          }
          return resolve(false)
        })
        .catch(err => {
          console.log(err)
          return reject(err);
        });
    });
  }

  async _initDir(files) {
    const asyncArr = [];
    //TODO: Add recursive directories
    files.forEach(file => {
      const filePath = `${this.drivePath}/${file}`;

      asyncArr.push(new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
          if(!stats.isDirectory()) {

          checksumFile('sha256', filePath)
            .then(async hash => {
              await this.db.put(file, {
                hash
              });
              await this.db.put(hash, {
                filename: file,
                hash,
                path: '/',
                size: stats.size,
              });``
              return resolve();
            })
            .catch(err => {
              console.log(err)
              return reject(err);
            });
          } else {
            return resolve();
          }
        });
      }));
    });
    await Promise.all(asyncArr);
  }

  _startSwarm({ db, topic, lookup, announce }) {
    this.swarm = hyperswarm();
    const topicBuf = Buffer.from(topic, 'hex');

    this.swarm.join(topicBuf, { lookup, announce });

    this.swarm.on('connection', async (socket, info) => {
      if (db) {
        let stream = await db.replicate(info.client, { stream: socket, live: true });
        pump(socket, stream, socket);
      }
    });
  }

  async _closeSwarm({ topic }) {
    const topicBuf = Buffer.from(topic, 'hex');
    this.swarm.leave(topicBuf);
  }
}

function createTopicHash(topic) {
  const crypto = require('crypto');
    
  return crypto.createHash('sha256')
    .update(topic)
    .digest();
}

function checksumFile(hashName, path) {
  const crypto = require('crypto');
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(hashName);
    const stream = fs.createReadStream(path);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = Drive;