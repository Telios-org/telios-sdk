const fs = require('fs');
const path = require('path');
const Hyperdrive = require('hyperdrive');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const pump = require('pump');
const sodium = require('sodium-native');
const Crypto = require('./crypto');
const Swarm = require('./drive.swarm');
const p2plex = require('p2plex');
const level = require('level');
const rimraf = require('rimraf');
const stream = require('stream');
const EventEmitter = require('events');

const DEFAULT_OPTS = {
  writable: true
}

class Drive extends EventEmitter {
  constructor(drivePath, publicKey, feedKey, { keyPair, writable }) {
    super();

    // Store for hyperdrives
    this.hyperstore = {};
    // level db for hypercores/hyperdrives
    this.hyperdb = null;
    // Key used to clone and seed drive. Should only be shared with trusted sources
    this.publicKey = publicKey;
    this.feedKey = feedKey;
    // Is this driving seeding another remote drive
    this.seed = feedKey ? true : false;
    this.feed = null;
    // P2P DB
    this.db = null;
    // Drive owner keypair
    this.keyPair = keyPair;
    // Key to be shared publicly to connect with peers hosting the shared drive
    this.discoveryKey = publicKey ? createTopicHash(publicKey).toString('hex'): null; 
    // If true watch for updates to local drive and write those updates to the DB
    this.writable = typeof writable !== 'undefined' ? writable : DEFAULT_OPTS.writable;
    // Don't watch while drive is being initialized
    // Path where drive metadata is stored
    this.metaPath = drivePath + '/.drive';
    // Path of files to be shared
    this.drivePath = drivePath;
    this.opened = false;

    // Initialize a fresh drive
    this._create = false;
    this._connections = [];
    this._lastSeq = 0;
    this._diffSyncInProgress = true;

    if(!fs.existsSync(drivePath)) {
      fs.mkdirSync(drivePath);
      fs.mkdirSync(drivePath + '/.drive');
      this._create = true;
    }

    // If there aren't any Hyperbee DBs then bootstrap new drive
    if(!fs.existsSync(path.join(drivePath,'/.drive/db'))) {
      this._create = true;
    }
  }

  async ready() {
    await this._initHyperstore();

    if(this.seed) {
      try {
        const lastSeq = await this.hyperdb.get('lastSeq');
        
        if(lastSeq) {
          this._lastSeq = lastSeq.seq;
        }

      } catch(e) {
        // no key found
      }

      this.feed = Hypercore(path.join(this.drivePath, './.drive/db'), this.feedKey, { valueEncoding: 'utf-8' });
    } else {
      this.feed = Hypercore(path.join(this.drivePath, './.drive/db'), { valueEncoding: 'utf-8' });
    } 


    this.db = new Hyperbee(this.feed, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    });

    await this.db.ready();

    if(this.seed) {
      this._syncRemoteUpdates();

      this.db.feed.on('sync', () => {
        this._syncDiffs(this._lastSeq);
      })
    }
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

    const server = new Swarm({
      keyPair: this.keyPair,
      topic: createTopicHash(this.publicKey),
      lookup: false,
      announce: true
    });
    this._connections.push(server);

    server.on('file-request', async (data, peer) => {
      console.log(`${this.keyPair.publicKey} Request for files ${JSON.stringify(data.files)} | from peer ${data.peerPubKey}`);
      const fileRequests = [];

      for(let file of data.files) {
        fileRequests.push(new Promise(async (resolve, reject) => {
          const _file = await this.db.get(file.hash);

          if(!_file || !fs.existsSync(path.join(this.drivePath, _file.value.fileName))) {
            resolve();
          }
          
          const stream = peer.createStream(file.hash);

          stream.write(JSON.stringify({ file: _file }));

          stream.end();

          stream.on('end', () => {
            resolve();
          });
        }))
      }

      await Promise.all(fileRequests);
    });
  

    const replicate = new Swarm({
      keyPair: this.keyPair,
      db: this.db,
      topic: this.publicKey,
      lookup: this.seed ? true : false,
      announce: this.seed ? false : true
    });
    this._connections.push(replicate);
    
    this.opened = true;
  }

  _syncDiffs(currentVer) {
    const diffStream = this.db.createDiffStream(currentVer);
    diffStream.on('data', async diff => {
      if(!diff.left && diff.right.value.name) {
        await this._destroyStorage(data.right.value.core);
        this.emit('file-unlink', diff.right.value);
      }

      if(diff.left.value.name) {
        await this.writeFile({ driveKey: diff.left.value.core, corePath: diff.left.value.path });
        this.emit('file-update', diff.left.value);
      }
    });

    diffStream.on('end', () => {
      setTimeout(async () => {
        const lastVer = await this.hyperdb.get('lastSeq');

        if(currentVer < lastVer.seq) {
          this._diffSyncInProgress = true;
          this._syncDiffs(lastVer.seq);
        } else {
          // We're all caught up
          this._diffSyncInProgress = true;
        }
      }, 500)
    })
  }

  _syncRemoteUpdates() {
    const historyStream = this.db.createHistoryStream({ gt: this._lastSeq, live: true })

    historyStream.on('data', async data => {
      this.hyperdb.put('lastSeq', { seq: this.db.version });
      if(!this._diffSyncInProgress || this._lastSeq === 0) {
        
        // Make updates here since we're all caught up
        if(data.type === 'put' && data.value.name) {
          await this.writeFile({ driveKey: data.value.key, filePath: data.value.path });
          this.emit('file-update', data.value);
        }

        if(data.type === 'del') {
          // Check if key value is a file path. 
          // Probably a better way to check for this.
          if(data.key.indexOf('/') > -1) {
            await this._destroyStorage(data.key);
            this.emit('file-unlink', data.key);
          }
        }
      }
    })
  }

  /**
   * Add a file as a hyperdrive
   */
  async writeFile({ driveKey, filePath, readStream, encrypted }) {

    // Sync remote drive and return
    if(driveKey) {
      return this._getHyperFile(filePath, { driveKey });
    }

    return new Promise(async (resolve, reject) => {
      const pathSeg = filePath.split('/');
      let fullFile = pathSeg[pathSeg.length - 1];
      let fileName;
      let fileExt;

      if(fullFile.indexOf('.') > -1) {
        fileName = fullFile.split('.')[0];
        fileExt = fullFile.split('.')[1];
      }

      const hyperFile = await this._getHyperFile(filePath, { replicate: false });
      const writeStream = hyperFile.createWriteStream('/' + fullFile);

      if (encrypted) {
        const { key, header, file } = await Crypto.encryptStream(readStream, writeStream);

        await this.db.put(filePath, {
          hash: file.hash
        });

        await this.db.put(file.hash, {
          name: fileName,
          size: file.size,
          mimetype: fileExt,
          path: filePath,
          key: hyperFile.key.toString('hex')
        });

        this.emit('file-add', file, { key, header });
        
        resolve({ key, header, file });
      } else {
        pump(readStream, writeStream, () => {
          let bytes = '';
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256');
          const stream = drive.createReadStream(`/${fullFile}`);

          stream.on('error', err => reject(err));
          
          stream.on('data', chunk => {
            bytes += chunk.toString().length;
            hash.update(chunk)
          });
          
          stream.on('end', async () => {
            const _hash = hash.digest('hex');

            await this.db.put(fileName, {
              hash: _hash
            });

            await this.db.put(_hash, {
              name: fileName,
              size: bytes,
              mimetype: fileExt,
              path: filePath,
              key: drive.key.toString('hex')
            });

            this.emit('file-add', { file: { hash: _hash, size: bytes } });
            
            resolve({ file: { hash: _hash, size: bytes }})
          });
        });
      }
    });
  }

  async readFile(filePathOrHash, opts) {
    return new Promise(async (resolve, reject) => {
      let res;

      res = await this.db.get(filePathOrHash);
      
      if(res.value.hash) {
        res = await this.db.get(res.value.hash);
      }

      const hyperdrive = this.hyperstore[res.value.path];

      // Get file stream from hyperdrive
      const encStream = hyperdrive.createReadStream(`${res.value.name}.${res.value.mimetype}`);

      // If key and header passed in then decipher file
      if(opts && opts.key && opts.header) {
        const decryptedStream = Crypto.decryptStream(encStream, { key: opts.key, header: opts.header, start: 24 });
        resolve(decryptedStream);
      } else {  
        resolve(encStream);
      }

    });
  }

  async unlink(filePathOrHash) {
    return new Promise(async (resolve, reject) => {
      let res;
      let file;

      const delArr = [];

      res = await this.db.get(filePathOrHash);
      
      if(res.value.hash) {
        delArr.push(this.db.del(res.value.hash));
        res = await this.db.get(res.value.hash);
        delArr.push(this.db.del(filePathOrHash));
      } else {
        delArr.push(this.db.del(filePathOrHash));
        delArr.push(this.db.del(res.value.path));
      }

      file = { ...res.value };

      await Promise.all(delArr);
      await this._destroyStorage(res.value.path);
      this.emit('file-unlink', file.path);
      resolve(file);
    });
  }

  async _destroyStorage(filePath) {
    const hyperdrive = this.hyperstore[filePath];

    if(hyperdrive) {
      await hyperdrive.close()
      delete this.hyperstore[filePath];

      rimraf.sync(path.join(`${this.drivePath}/${filePath}`));
    }
  }

  async _initHyperstore() {
    const asyncArr = [];
    this.hyperdb = level(path.join(this.metaPath, '/hyperstore'), { valueEncoding: 'json' });

    return new Promise((resolve, reject) => {
      this.hyperdb.createReadStream()
        .on('data', (data) => {
          if(data.value.type === 'hyperdrive') {
            asyncArr.push(this._getHyperFile(data.key));
          }
        })
        .on('error', (err) => {
          reject(err);
        })
        .on('end', async () => {
          await Promise.all(asyncArr);
          resolve();
        });
    });
  }

  async _getHyperFile(filePath, opts) {
    let hyperdrive;

    return new Promise(async (resolve, reject) => {
      this.hyperdb.get(filePath, (err, value) => {

        if(value && this.hyperstore[filePath]) {
          return resolve(this.hyperstore[filePath]);
        }
      
        hyperdrive = Hyperdrive(path.join(this.drivePath, filePath), opts.driveKey, { sparse: false, sparseMetadata: false });
    
        hyperdrive.on('ready', () => {
          const key = hyperdrive.key.toString('hex');
          
          if(!value) {
            this.hyperdb.put(filePath, { 
              type: 'hyperdrive',
              key,
              replicate: !!opts.replicate
            });
          }

          this.hyperstore[filePath] = hyperdrive;

          // if(replicate) {

          // }

          resolve(hyperdrive);
        });

      });
    });
  }

  /**
   * Connect as a client and request to download files
   */
  static async getRemoteFileMeta(discoveryKey, files, { keyPair }) {
    const eventEmitter = new EventEmitter();
    let connected = false;
    const _files = [];
    const fileRequests = [];

    for(let file of files) {
      _files.push({ hash: file.hash });
    }

    const swarm = new Swarm({
      keyPair,
      topic: discoveryKey,
      lookup: true,
      announce: false
    });

    swarm.once('peer-add', p => {
      const plex = p2plex();
      plex.join(Buffer.from(p.publicKey, 'hex'), { announce: false, lookup: true });

      process.nextTick(() => {
        plex.on('connection', async peer => {
          if(peer.publicKey.toString('hex') !== p.publicKey && !connected) {
            connected = true;
            
            peer.createStream('request').end(JSON.stringify({ 
              discoveryKey,
              files: _files, 
              peerPubKey: keyPair.publicKey 
            }));

            // Open up a new stream to listen for each file requested
            for(let file of files) {
              fileRequests.push(new Promise((resolve, reject) => {
                const stream = peer.receiveStream(file.hash);
                let message = '';

                stream.on('data', (chunk) => {
                  message += chunk.toString('utf8')
                });

                stream.on('end', () => {
                  const fileMeta = JSON.parse(message);

                  //TODO: Connect to hyperdrive and download file
                  resolve(fileMeta);
                })
              }));
            }

            await Promise.all(fileRequests);
            await swarm.close();
            plex.destroy();
            eventEmitter.emit('finished');
          }
        });
      });

      setTimeout(async () => {
        if(!connected) {
          plex.destroy();
          eventEmitter.emit('error', 'Failed to connect to any peers within the alotted time.');
        }
      }, 5000);
    });

    return eventEmitter;
  }

  static decryptStream({ key, header, start }) {
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

  static encryptStream() {
    const key = Crypto.generateStreamKey();
    let { state, header } = Crypto.initStreamPushState(key);

    return new stream.Transform({
      writableObjectMode: true,
      transform
    });

    function transform(chunk, encoding, callback) {
      Crypto.secretStreamPush(chunk, state);

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

    if(this.slaveDB) {
      await this.slaveDB.close();
    }

    await this.hyperdb.close();
    
    await this.db.feed.close();
    
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