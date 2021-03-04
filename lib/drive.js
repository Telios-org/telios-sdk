const fs = require('fs');
const path = require('path');
const MultiHyperbee = require('multi-hyperbee');
const pump = require('pump');
const sodium = require('sodium-native');
const Auth = require('./drive.auth');
const Swarm = require('./drive.swarm');
const chokidar = require('chokidar');
const p2plex = require('p2plex');
const Hyperbeam = require('hyperbeam');
const MemoryStream = require('memorystream');
const level = require('level');

class Drive extends Auth {
  constructor(drivePath, publicKey, { keyPair, ignore, seed, live, watch, access, slave }) {
    super();

    this.db = null; // P2P DB
    this.accessPolicy = access;  // // Access policy at the drive level
    this.slave = slave; // Orphan drives can only seed and have no write permissions
    this.slaveDB = null; // Local conifg store for slave drives
    this.keyPair = keyPair; // Drive owner keypair
    this.seed = seed; // Seed this drive to peers when ready
    this.publicKey = publicKey; // Key used to clone and seed drive. Should only be shared with trusted sources
    this.discoveryKey = publicKey ? createTopicHash(publicKey).toString('hex'): null; // Key to be shared publicly to connect with peers hosting the shared drive
    this.live = live; // If true this will connect the drive to the network
    this.watch = watch; // If true watch for updates to local drive and write those updates to the DB
    this.readyToWatch = false; // Don't watch while drive is being initialized
    this.peers = []; // Connected peers (should be peers acting as servers)
    this.metaPath = drivePath + '/.drive'; // Path where drive metadata
    this.drivePath = drivePath; // Path of files to be shared
    this.ignore = ignore; // File pattern to ignore in drivePath
    this.diffFeedKey = null; // Diff DB feed key
    
    this._server = null; // Server hyperswarm instance
    this._diffHyperbee = null;
    this._accessDB = null; // Sub DB for access control
    this._create = false; // Initialize a fresh drive
    this._isClone = false; // Cloned from a remote drive
    this._watcher = null // Directory watcher
    this._incomingFiles = {};
    this._connections = [];
    this._busy = false;

    if(!fs.existsSync(drivePath)) {
      fs.mkdirSync(drivePath);
      fs.mkdirSync(drivePath + '/.drive');
      this._create = true;
    }

    // If there aren't any Hyperbee DBs then bootstrap new drive
    if(fs.existsSync(path.join(drivePath, '/.drive')) && 
      !fs.existsSync(path.join(drivePath,'/.drive/db')) || 
      !fs.existsSync(path.join(drivePath,'/.drive/db_diff'))
    ) {
      this._create = true;
    }
  }

  async ready() {
    this.db = new MultiHyperbee(path.join(`${this.metaPath}`, '/db'), { keyEncoding: 'utf-8', valueEncoding: 'json' });
    this._diffHyperbee = await this.db.getDiff();
    this.diffFeedKey = this._diffHyperbee.feed.key.toString('hex');

    await this.db.ready();
    //this._accessDB = await this.db.sub('__access');

    if (this._create && !this.publicKey) {
      // Create and bootstrap new drive
      await this._init();
    }

    if(this._create && this.publicKey) {
      // Create a clone from existing remote drive
      this._isClone = true;
    }

    if(!this._create) {
      // Reconnect existing drive
      const publicKey = await this.db.get('__publicKey');
      this.publicKey = publicKey.value.key;
      this.discoveryKey = createTopicHash(this.publicKey).toString('hex');
    }

    /**
     * When a seed drive is set to slave it won't have the ability to
     * write to the DB. It could, but it would be constantly overwritten
     * by the other peers. In order to maintain an access policy, slave peers
     * will need to store which peers can write to this drive locally.
     * 
     * TODO: Should probably encrypt this.
     */
    if(this.slave) {
      this.slaveDB = level(path.join(this.metaPath, '/access'), { valueEncoding: 'json' });

      try {
        const canWrite = await this.slaveDB.get('canWrite');
        this.db.addWriters(canWrite);
      } catch(err) {
        await this.slaveDB.put('canWrite', []);
      }
    }

    if(this.seed) {
      // Connect as server
      const server = new Swarm({
        keyPair: this.keyPair,
        topic: createTopicHash(this.publicKey),
        lookup: false,
        announce: true
      });
      this._connections.push(server);

      server.on('file-request', async (data, peer) => {
        console.log(`${this.keyPair.publicKey} Request for file ${data.fileHash} | from peer ${data.peerPubKey}`);
        const file = await this.db.get(data.fileHash);

        if(!file) {
          await peer.disconnect();
        }
        
        const stream = peer.createStream('ingress');
        const rs = fs.createReadStream(`${this.drivePath}/${file.value.filename}`);

        pump(rs, stream, async () => {
          await peer.disconnect();
        });
      });
    }

    if (this.live) {
      // DB Replication
      const replicate = new Swarm({
        keyPair: this.keyPair,
        db: this.db,
        topic: this.publicKey,
        lookup: true,
        announce: true
      });
      this._connections.push(replicate);

      // Connect as client
      const client = new Swarm({
        keyPair: this.keyPair,
        topic: createTopicHash(this.publicKey),
        lookup: true,
        announce: false
      });
      this._connections.push(client);

      client.on('peer-add', (peer) => {
        this.peers.push(peer.publicKey);
        this.readyToWatch = true;

        if (this.watch) {
          this._watchRemoteDrive();
          this._watchLocalDrive();
        }
      });
    } else {
      this.readyToWatch = true;

      if (this.watch) {
        this._watchRemoteDrive();
        this._watchLocalDrive();
      }
    }

    
  }

  async _init() {
    let pubKeyBuf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
  
    sodium.randombytes_buf(pubKeyBuf);
  
    this.publicKey = pubKeyBuf.toString('hex');
    this.discoveryKey = createTopicHash(this.publicKey).toString('hex');

    if(this.accessPolicy) {
      await this.db.put('__access', this.accessPolicy);
    }

    await this.db.put('owner', { key: this.keyPair.publicKey.toString('hex') });
    console.log('Owner ', this.keyPair.publicKey.toString('hex'));
    
    await this.db.put('__publicKey', { key: this.publicKey });
    console.log('Drive public key ', this.publicKey);

    const files = fs.readdirSync(this.drivePath);
    await this._initDir(files); // Load all file metadata into Hyperbee DB
    this.readyToWatch = true;
  }

  async addPeer(peer) {
    
    // Let this peer update our DB
    if(peer.access && peer.access.indexOf('write') > -1) {
      
      if(this.slave) {
        try {
          await this._updateSlaveWriters([peer.diffKey]);
        } catch(err) {
          throw err;
        }
      } else {
        const accessPolicy = await this.db.get('__access');
        accessPolicy.value.canWrite.push(peer.diffKey);
        await this.db.put('__access', accessPolicy.value);
      }
    }
    await this.db.addPeer(peer.diffKey);
  }

  // Watch for file changes on the drive
  _watchLocalDrive() {
    // Initialize local watcher.
    this._watcher = chokidar.watch(this.drivePath, {
      ignored: this.ignore ? this.ignore : /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      cwd: this.drivePath
    });

    this._watcher
      .on('add', path => {
        // console.log(`File ${path} has been added`)
      })
      .on('change', async (filename) => {
        if(this._incomingFiles[filename] || this._busy) return;

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
  }

  // Watch for remote drive changes
  _watchRemoteDrive() {
    const hs = this.db.createHistoryStream({ live: true, gte: -1 });

    hs.on('data', async data => {
      if(data.key === 'publicKey') {
        this.publicKey = data.value.key;
      }

      // Merge access policy updates from peers into slave's local DB
      if(data.key === '__access' && this.slave) {
        await this._updateSlaveWriters(data.value.canWrite);
      }

      if (data.value && data.value.filename && this.readyToWatch) {
        try {
          const needsUpdate = await this._fileNeedsUpdate(data.value);

          if(needsUpdate && !this._incomingFiles[data.value.filename]) {
            // Grab one of the server peers and plex.findByPublicKey
            const hostPeerKey = Buffer.from(this.peers[0], 'hex');

            // Outgoing Requests
            const plex = p2plex();
            plex.join(hostPeerKey, { announce: false, lookup: true });

            process.nextTick(() => {
              plex.on('connection', peer => {
                if(peer.publicKey.toString('hex') !== hostPeerKey.toString('hex')) {
                  if(!this._incomingFiles[data.value.filename]) {
                    this._incomingFiles[data.value.filename] = true;
                    this._busy = true;
                    console.log(`Updating Local File ${data.value.filename} on ${this.drivePath}`);

                    const stream = peer.receiveStream('ingress');
                    const ws = fs.createWriteStream(`${this.drivePath}/${data.value.filename}`);
                    
                    peer.createStream('request').end(JSON.stringify({ 
                      fileHash: data.value.hash, peerPubKey: 
                      this.keyPair.publicKey 
                    }));

                    pump(stream, ws, (err) => {
                      if(err) throw err;
                      
                      // Yuck
                      setTimeout(() => {
                        delete this._incomingFiles[data.value.filename];
                        plex.destroy();
                        console.log(' ');
                        this._busy = false;
                        this.emit('add', `File ${path} has been added`);
                      }, 350);
                    });
                  }
                }
              });
            });
          }
        } catch(err) {
          console.log(err);
          throw err;
        }
      }
    });
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

  async _updateSlaveWriters(peerDiffKeys) {
    if(!peerDiffKeys || !peerDiffKeys.length) return;

    try {
      const canWrite = await this.slaveDB.get('canWrite');

      for(const key of peerDiffKeys) {
        // Don't merge if key already exists
        if(canWrite.indexOf(key) === -1) {
          canWrite.push(key);
        }
      }
      this.db.addWriters(canWrite);
      await this.slaveDB.put('canWrite', canWrite);
    } catch(err) {
      throw err;
    }
  }

  // Close drive and disconnect from Hyperswarm
  async close() {
    for(let conn of this._connections) {
      await conn.close();
    }
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