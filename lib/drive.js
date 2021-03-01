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

      this._connectToPublicTopic({ announce: this.isClone, lookup: !this.isClone });
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

    console.log('Drive discovery key ', topic.toString('hex'));
    
    this.plex.on('connection', peer => {
      console.log('Peer connected', peer.publicKey.toString('hex'));
      const rs = peer.createSharedStream('request');
      rs.on('data', data => {
        this._serveFile(data.toString('utf8'), peer.publicKey.toString('hex'));
      });
    });
    
    this.plex.join(topic, { announce, lookup });
  }

  // Watch for file changes on the drive
  _watchDrive() {
    // Initialize local watcher.
    this.watcher = chokidar.watch(this.drivePath, {
      ignored: this.ignore ? this.ignore : /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    this.watcher
      .on('add', path => {
        this.emit('add', `File ${path} has been added`)
        // console.log(`File ${path} has been added`)
      });
    
    this.watcher
      .on('raw', (event, path, details) => { // internal
        // console.log(`${event} : ${path}`);
        if(event === 'change') {
          // Check if file is already in DB
          fs.stat(`${details.watchedPath}`, (err, stats) => {
            if(!stats.isDirectory()) {
              checksumFile('sha256', `${details.watchedPath}`)
                .then(async hash => {
                    const file = await this.db.get(path);

                    if(file.value.hash !== hash) {
                      await this.db.put(path, {
                        hash
                      });
                      await this.db.put(hash, {
                        filename: path,
                        hash,
                        path: '/',
                        size: stats.size,
                      });

                      console.log(`${file.key} has been updated!`);
                    }
                });
            }
          });
        }
      });

    // Watch for remote changes
    this.stream = this.db.createHistoryStream({ live: true, gte: -1 });
    this.memStream = new MemoryStream();
    

    this.stream.on('data', async data => {
      if(data.key === 'publicKey') {
        this.publicKey = data.value.key;
      }

      if (data.value.filename && this.readyToWatch) {
        console.log(data.value.filename)
        const ws = fs.createWriteStream(`${this.drivePath}/${data.value.filename}`);

        console.log(`Beam Receive : ${this.plex.publicKey.toString('hex')}.${data.value.hash}`)
        const beam = new Hyperbeam(`${this.plex.publicKey.toString('hex')}.${data.value.hash}`);
        
        pump(beam, ws, (err) => {
          if(err) console.log(err);
          //console.log('Beam Closed');
        })

        // Request file from peers
        this.plex.peers.forEach(peer => {
          const stream = peer.createStream('request');
          pump(this.memStream, stream, (err) => {
            console.log(err);
          })
        });

        this.memStream.write(data.value.hash);
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
    console.log(`Serve file : ${hash} to Peer ${peer}`);
    const file = await this.db.get(hash);
    const rs = fs.createReadStream(`${this.drivePath}/${file.value.filename}`);
    
    console.log(`Beam Sending : ${peer}.${hash}`)
    const beam = new Hyperbeam(`${peer}.${hash}`);

    pump(rs, beam, (err) => {
      if (err) throw err;
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