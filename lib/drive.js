const fs = require('fs');
const path = require('path');
const MultiHyperbee = require('multi-hyperbee');
const pump = require('pump');
const sodium = require('sodium-native');
const Auth = require('./drive.auth');
const Crypto = require('./crypto');
const Swarm = require('./drive.swarm');
const chokidar = require('chokidar');
const p2plex = require('p2plex');
const level = require('level');
const rimraf = require('rimraf');
const stream = require('stream');
const MemoryStream = require('memorystream');

const DEFAULT_OPTS = {
  seed: true,
  writable: true
}

class Drive extends Auth {
  constructor(drivePath, publicKey, { keyPair, ignore, seed, writable }) {
    super();

    this.db = null; // P2P DB
    this.slaveDB = null; // Local conifg store for slave drives
    this.keyPair = keyPair; // Drive owner keypair
    this.seed = typeof seed !== 'undefined' ? seed : DEFAULT_OPTS.seed; // Seed this drive to peers when ready
    this.publicKey = publicKey; // Key used to clone and seed drive. Should only be shared with trusted sources
    this.discoveryKey = publicKey ? createTopicHash(publicKey).toString('hex'): null; // Key to be shared publicly to connect with peers hosting the shared drive
    this.writable = typeof writable !== 'undefined' ? writable : DEFAULT_OPTS.writable; // If true watch for updates to local drive and write those updates to the DB
    this.readyToWatch = false; // Don't watch while drive is being initialized
    this.peers = []; // Connected peers (should be peers acting as servers)
    this.metaPath = drivePath + '/.drive'; // Path where drive metadata
    this.drivePath = drivePath; // Path of files to be shared
    this.ignore = ignore; // File pattern to ignore in drivePath
    this.diffFeedKey = null; // Diff DB feed key
    this.opened = false;

    this._server = null; // Server hyperswarm instance
    this._diffHyperbee = null;
    this._accessDB = null; // Sub DB for access control
    this._create = false; // Initialize a fresh drive
    this._watcher = null // Directory watcher
    this._incomingFiles = {};
    this._connections = [];
    this._busy = false;
    this._client = null;

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

    // Create and bootstrap new drive
    if (this._create && !this.publicKey) {
      await this._init();
    }

    // Reconnect existing drive
    if(!this._create) {
      const publicKey = await this.db.get('__publicKey');

      //TODO: Clean this up
      if(publicKey) {
        this.publicKey = publicKey.value.key;
      }

      this.discoveryKey = createTopicHash(this.publicKey).toString('hex');
    }

    /**
     * Set writable to false on drives that just seed content and don't intend to write or
     * have write access. If the other peer drives don't recognize this drive as another writer,
     * then any updates this drive makes will be overwritten by the other peers. In order to maintain 
     * an access policy, non-writable peers will need to store which peers can write to this drive locally.
     * 
     * TODO: Should probably encrypt this.
     */
    if(!this.writable) {
      this.slaveDB = level(path.join(this.metaPath, '/access'), { valueEncoding: 'json' });

      try {
        const canWrite = await this.slaveDB.get('canWrite');
        this.db.addWriters(canWrite);
      } catch(err) {
        await this.slaveDB.put('canWrite', []);
      }
    }

    /**
     * Setting the drive to seed will announce it's presence to other peers (clients and other replicating peers) connected
     * to the same hyperswarm topic, and allow them to request and download files this drive has.
     */
    if(this.seed) {
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

        if(!fs.existsSync(path.join(this.drivePath, file.value.filename))) {
          await peer.disconnect();
        }

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

    const replicate = new Swarm({
      keyPair: this.keyPair,
      db: this.db,
      topic: this.publicKey,
      lookup: true,
      announce: true
    });
    this._connections.push(replicate);

    this._connectClient();
    
    this.readyToWatch = true;

    this._watchRemoteDrive();

    if (this.writable) {
      this._watchLocalDrive();
    }

    this.opened = true;
  }

  /**
   * Add a peer to give them write access. In order for two drives to sync
   * bi-directionally, they would both need to add eachother as peers.
   */
  async addPeer(peer) {
    if(peer.access && peer.access.indexOf('write') > -1) {
      if(!this.writable) {
        try {
          await this._updateSlaveWriters([peer.diffKey]);
        } catch(err) {
          throw err;
        }
      } else {
        this._updateWriters([peer.diffKey]);
      }
    }
    await this.db.addPeer(peer.diffKey);
  }

  // Remove Peer
  async removePeer(peer) {
    // TODO: Update access policy
    await this.db.removePeer(peer.diffKey);
  }

  /**
   * Connect as a client and request to download a file.
   * Returns a stream to be piped to local file system.
   */
  static async download(discoveryKey, fileHash, { keyPair }) {
    let connected = false;

    const swarm = new Swarm({
      keyPair,
      topic: discoveryKey,
      lookup: true,
      announce: false
    });

    return new Promise((resolve, reject) => {
      swarm.on('peer-add', p => {
      
        const plex = p2plex();
        plex.join(Buffer.from(p.publicKey, 'hex'), { announce: false, lookup: true });

        process.nextTick(() => {
          plex.on('connection', peer => {
            if(peer.publicKey.toString('hex') !== p.publicKey && !connected) {
              const memStream = new MemoryStream();
              connected = true;
              peer.createStream('request').end(JSON.stringify({ 
                fileHash: fileHash, 
                peerPubKey: keyPair.publicKey 
              }));

              const stream = peer.receiveStream('ingress');

              pump(stream, memStream, () => {
                plex.destroy();
              });

              resolve(memStream);
            }
          });
        });

        setTimeout(async () => {
          if(!connected) {
            plex.destroy();
            reject('Failed to connect to any peers within the alotted time.');
          }
        }, 5000);
      });
    });
  }

  static decryptStream(str, { key, header, start }) {
    console.log(`Key: ${key}`);
    console.log(`Header: ${header}`);
    console.log(`start: ${start}`);
    let toSkip = start;
    const k = Buffer.from(key, 'hex');
    let h = Buffer.from(header, 'hex');
    let message = Buffer.from([]);
    let state = Crypto.initStreamPullState(h, k);

    return new stream.Transform({
      writableObjectMode: true,
      transform
    });

    function transform(chunk, encoding, callback) {
      if (toSkip == 0) {
        message = Crypto.secretStreamPull(chunk, state);
      } else if (toSkip > chunk.length) {
        toSkip -= chunk.length;
      } else {
        if (toSkip !== chunk.length) {
          message = Crypto.secretStreamPull(chunk.slice(toSkip), state);
        }
        toSkip = 0;
      }

      callback(null, message);
    }
  }

  size() {
    return getTotalSize(this.drivePath);
  }

  /**
   * Close drive and disconnect from all Hyperswarm topics
   */
  async close() {
    for(let conn of this._connections) {
      await conn.close();
    }

    if(this._client) {
      await this._client.close();
    }

    await this.db.close();
    this.openend = false;
  }

  /**
   * Initalizes a new drive
   */
  async _init() {
    let pubKeyBuf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
  
    sodium.randombytes_buf(pubKeyBuf);
  
    this.publicKey = pubKeyBuf.toString('hex');
    this.discoveryKey = createTopicHash(this.publicKey).toString('hex');

    await this.db.put('__access', { canRead: null, canWrite: []});
    await this.db.put('__publicKey', { key: this.publicKey });

    console.log('Drive public key ', this.publicKey);

    const files = fs.readdirSync(this.drivePath);
    await this._initDir(files); // Load all file metadata into Hyperbee DB
    this.readyToWatch = true;
  }

  /**
   * Connect to this drive's public hyperswarm topic as a client
   * for the purpose of requesting and downloading files from the
   * remote drive.
   */
  _connectClient() {
    this._client = new Swarm({
      keyPair: this.keyPair,
      topic: createTopicHash(this.publicKey),
      lookup: true,
      announce: false
    });
  }

  /**
   * Watch for changes on the local drive and send those updates
   * to any connected peers.
   */
  _watchLocalDrive() {
    // Initialize local watcher.
    this._watcher = chokidar.watch(this.drivePath, {
      ignored: this.ignore ? this.ignore : /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      cwd: this.drivePath
    });

    this._watcher
      .on('add', async (filename) => {
        if(this._incomingFiles[filename] || this._busy) return;

        const fullPath = path.join(this.drivePath, filename);
        // Check if file is already in DB
        const stats = fs.statSync(fullPath);

        if(!stats.isDirectory()) {
          const hash = await checksumFile('sha256', fullPath);
          const file = await this.db.get(filename);

          if(!file) {
            await this.db.put(filename, {
              hash
            });
            await this.db.put(hash, {
              filename,
              hash,
              path: '/',
              size: stats.size,
              updatedBy: this.keyPair.publicKey
            });
          }

          this.emit('file-add', { fileName: filename, filePath: fullPath, hash, source: 'local' });
        }
      })
      .on('change', async (filename) => {
        if(this._incomingFiles[filename] || this._busy) return;

        const fullPath = path.join(this.drivePath, filename);
        // Check if file is already in DB
        const stats = fs.statSync(fullPath);

        if(!stats.isDirectory()) {
          const hash = await checksumFile('sha256', fullPath);
          const file = await this.db.get(filename);

          if(file && file.value.hash !== hash) {
            await this.db.put(filename, {
              hash
            });
            await this.db.put(hash, {
              filename,
              hash,
              path: '/',
              size: stats.size,
              updatedBy: this.keyPair.publicKey
            });

            console.log(`${filename} has been updated on ${this.drivePath}`);
            this.emit('file-update', { fileName: filename, filePath: fullPath, hash, source: 'local' });
          }
        }
      })
      .on('unlink', async (filename) => {
        if(this._incomingFiles[filename] || this._busy) return;

        const f = await this.db.get(filename);
        const file = await this.db.get(f.value.hash);

        await this.db.put(filename, { 
          deleted: true,
          filename,
          path: file.value.path 
        });
        await this.db.put(f.value.hash, { deleted: true });

        console.log(`${filename} has been removed on ${this.drivePath}`);
        this.emit('file-unlink', { filePath: path.join(__dirname, file.value.path), source: 'local' });
      });
  }

  /**
   * Watch for changes coming in from remote drives
   */
  _watchRemoteDrive() {
    const hs = this.db.createHistoryStream({ live: true, gte: -1 });

    hs.on('data', async data => {
      if(data.key === 'publicKey') {
        return this.publicKey = data.value.key;
      }

      // Merge access policy updates from peers into slave's local DB
      if(data.key === '__access' && !this.writable) {
        return await this._updateSlaveWriters(data.value.canWrite);
      }

      if (data.value && data.value.filename && this.readyToWatch) {
        // File was remotely deleted and needs to be removed locally
        if(data.value.deleted && data.value.path) {
          const rmPath = path.join(this.drivePath, data.value.path, data.value.filename);
          
          if(fs.existsSync(rmPath)) {
            rimraf.sync(rmPath);
            return this.emit('file-unlink', { filePath: rmPath, source: 'remote' });
          }
          return;
        }

        try {
          // Only request files when the remote hash differs from the local hash
          const needsUpdate = await this._fileNeedsUpdate(data.value);

          if(needsUpdate && !this._incomingFiles[data.value.filename]) {
            console.log('Connect to peer => ', data.value.updatedBy);
            const hostPeerKey = Buffer.from(data.value.updatedBy, 'hex');
            
            // Outgoing Requests
            await this._requestFile({ peerKey: hostPeerKey, file: data.value });
          }
        } catch(err) {
          console.log(err);
          throw err;
        }
      }
    });
  }

  /**
   * Only request files when the remote hash differs from the local hash
   */
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

  _requestFile({ peerKey, file }) {
    let fileEvt = 'file-update';
    // If incoming file doesn't exist then emit file add event
    if(!fs.existsSync(path.join(this.drivePath, `${file.path}${file.filename}`))) {
      fileEvt = 'file-add';
    }

    return new Promise((resolve, reject) => {
      let peerOnline = false;
      const plex = p2plex();
      plex.join(peerKey, { announce: false, lookup: true });

      process.nextTick(() => {
        plex.on('connection', peer => {
          
          peerOnline = true;

          if(peer.publicKey.toString('hex') !== peerKey.toString('hex')) {
            if(!this._incomingFiles[file.filename]) {
              this._incomingFiles[file.filename] = true;
              this._busy = true;

              //TODO: Replace / with file.path
              const filePath = `${this.drivePath}/${file.filename}`;

              console.log(`Updating Local File ${file.filename} on ${this.drivePath}`);

              const stream = peer.receiveStream('ingress');
              const ws = fs.createWriteStream(filePath);
              
              peer.createStream('request').end(JSON.stringify({ 
                fileHash: file.hash, 
                peerPubKey: this.keyPair.publicKey 
              }));

              pump(stream, ws, (err) => {

                // Yuck
                setTimeout(() => {
                  delete this._incomingFiles[file.filename];
                  plex.destroy();
                  console.log(`File ${file.filename} Retrieved!`)
                  console.log(' ');
                  this._busy = false;
                  
                  this.emit(fileEvt, { 
                    fileName: file.filename, 
                    filePath: filePath, 
                    hash: file.hash, 
                    source: 'remote' 
                  });
                  
                  return resolve(fileEvt, filePath);
                }, 350);
              });
            }
          }
        });
      });

      setTimeout(async () => {
        if(!peerOnline) {
          plex.destroy();
          try {
            this._busy = true;
            const peer = await this._client.refreshPeers();
            this._requestFile({ peerKey: Buffer.from(peer.publicKey, 'hex'), file });
          } catch(err) {
            reject('Failed to connect to any peers within the alotted time.');
          }
        }
      }, 5000);
    });
  }

  /**
   * If files are already present at a new drive's location then load their
   * metadata into the drive's database.
   */
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
                updatedBy: this.keyPair.publicKey
              });
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

  async _updateWriters(peerDiffKeys) {
    const accessPolicy = await this.db.get('__access');

    if(!accessPolicy) {
      this.db.addWriters(peerDiffKeys);
    } else {
      for(const key of peerDiffKeys) {
        accessPolicy.value.canWrite.push(key);
      }

      await this.db.put('__access', accessPolicy.value);
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
    

const getAllFiles = function(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, file))
    }
  })

  return arrayOfFiles
}

const convertBytes = function(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  if (bytes == 0) {
    return "n/a"
  }

  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))

  if (i == 0) {
    return bytes + " " + sizes[i]
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i]
}

const getTotalSize = function(directoryPath) {
  const arrayOfFiles = getAllFiles(directoryPath)

  let totalSize = 0

  arrayOfFiles.forEach(function(filePath) {
    totalSize += fs.statSync(filePath).size
  })

  return totalSize;
}

module.exports = Drive;