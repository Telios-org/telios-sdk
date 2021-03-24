const fs = require('fs');
const path = require('path');
const Hypercore = require('hypercore');
const Hypertrie = require('hypertrie');
const pump = require('pump');
const sodium = require('sodium-native');
const Crypto = require('./crypto');
const Swarm = require('./drive.swarm');
const p2plex = require('p2plex');
const level = require('level');
const stream = require('stream');
const EventEmitter = require('events');
const SDK = require('hyper-sdk');

const DEFAULT_OPTS = {
  writable: true
}

class Drive extends EventEmitter {
  constructor(drivePath, publicKey, { keyPair, writable }) {
    super();

    // Hyper SDK
    this.sdk = null;
    // Store for hypercores
    this.hyperstore = {};
    // level db for hypercores
    this.hyperdb = null;
    // Key used to clone and seed drive. Should only be shared with trusted sources
    this.publicKey = publicKey;
    // Is this driving seeding another remote drive
    this.seed = publicKey ? true : false;
    // Local Hypercore feed
    this.feed = null;
    // Remote Hypercore feed key for replication
    //this.feedKey = feedKey;
    // P2P DB
    this.db = null;
    // Sub DB for files
    this.db = null;
    // Drive owner keypair
    this.keyPair = keyPair;
    // Key to be shared publicly to connect with peers hosting the shared drive
    this.discoveryKey = publicKey ? createTopicHash(publicKey).toString('hex'): null; 
    // If true watch for updates to local drive and write those updates to the DB
    this.writable = typeof writable !== 'undefined' ? writable : DEFAULT_OPTS.writable;
    // Don't watch while drive is being initialized
    // Path where drive metadata is stored
    this.metaPath = drivePath + '/.meta';
    // Path of files to be shared
    this.drivePath = drivePath;
    this.opened = false;

    // Initialize a fresh drive
    this._create = false;
    this._connections = [];
    this._lastSeq = 0;
    this._diffSyncInProgress = false;

    if(!fs.existsSync(drivePath)) {
      fs.mkdirSync(drivePath);
      fs.mkdirSync(drivePath + '/.meta');
      this._create = true;
    }

    // If there aren't any Hyperbee DBs then bootstrap new drive
    if(!fs.existsSync(path.join(drivePath,'/.meta/db'))) {
      this._create = true;
    }
  }

  async ready() {
    const self = this;

    this.sdk = await SDK({
      persist: true,
      storage: this.drivePath
    });

    await this._initHyperstore();

    if(this.seed) {
      try {
        // TODO: Replace with hyperbee
        const lastSeq = await this.hyperdb.get('lastSeq');
        
        if(lastSeq) {
          this._lastSeq = lastSeq.seq;
        }

      } catch(e) {
        // no key found
      }

      this.feed = Hypercore(path.join(this.drivePath, './.meta/db'), this.publicKey);
    } else {
      this.feed = Hypercore(path.join(this.drivePath, './.meta/db'));
    } 

    this.db = new Hypertrie(null, {
      feed: this.feed,
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    });

    await this._initDB();
    
    this.publicKey = this.db.feed.key.toString('hex');
    this.discoveryKey = createTopicHash(this.publicKey).toString('hex');

    if(this.seed) {
      this._syncRemoteUpdates();

      let blockCnt = 0;

      this.db.feed.on('download', () => {
        blockCnt += 1;

        if(blockCnt === this.db.feed.length) {
          this._syncDiffs(this._lastSeq);
        }
      })
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
          const _file = await getFile(file.hash);
 
          const stream = peer.createStream(file.hash);

          if(!_file) {
            stream.end(JSON.stringify({ error: 'File not found.' }));
            return resolve();
          }

          stream.write(JSON.stringify(_file.value));

          stream.end();

          stream.on('end', () => {
            resolve();
          });
        }))
      }
      
      function getFile(hash) {
        return new Promise((resolve, reject) => {
          self.db.get(hash, (err, item) => {
            if(err) return reject(err);
            resolve(item);
          })
        });
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

  async _initDB() {
    return new Promise((resolve, reject) => {
      this.feed.on('ready', () => {
        resolve();
      });
    });
  }

  _syncDiffs(currentVer) {
    if(!this._diffSyncInProgress) {
      
      this._diffSyncInProgress = true;

      const diffStream = this.db.createDiffStream(currentVer);

      diffStream.on('data', async diff => {
        if(currentVer > 0) {
          if(!diff.left) {
            await this._destroyStorage(diff.right.key);
            this.emit('file-unlink', { path: diff.right.key, hash: diff.right.value.hash });
          }
          if(diff.left && diff.left.value && diff.left.value.name) {
            await this.writeFile({ feedKey: diff.left.value.key, filePath: diff.left.value.path });
            this.emit('file-update', diff.left.value);
          }
        }
      });

      diffStream.on('end', async () => {
        this._diffSyncInProgress = false;

        // Run syncDiffs again if new changes occurred while syncing previous diffs
        if(currentVer < this._lastSeq) {
          this._syncDiffs(this._lastSeq);
        }
      })
    }
  }

  _syncRemoteUpdates() {
    const historyStream = this.db.createHistoryStream({ gt: this._lastSeq, live: true })

    historyStream.on('data', async data => {
      
      if(!this._diffSyncInProgress || this._lastSeq === 0) {
        this.hyperdb.put('lastSeq', { seq: data.seq });
        this._lastSeq = data.seq;
      }
    })
  }

  /**
   * Add a file as a hypercore
   */
  async writeFile({ feedKey, filePath, readStream, encrypted }) {
    if(filePath[0] === '/') {
      filePath = filePath.slice(1, filePath.length);
    }

    // Sync remote drive and return if a remote drive key is passed in
    if(feedKey) {
      return this._getHyperFile(filePath, null, { feedKey });
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

      const hyperFile = await this._getHyperFile(filePath, null, { replicate: false });
      const writeStream = hyperFile.createWriteStream();

      if (encrypted) {
        const { key, header, file } = await Crypto.encryptStream(readStream, writeStream);
        const fileVal = {
          name: fileName,
          size: file.size,
          mimetype: fileExt,
          path: filePath,
          encrypted: true,
          hash: file.hash,
          key: hyperFile.key.toString('hex')
        }
        this.db.batch([
          {
            key: filePath,
            value: {
              hash: file.hash
            }
          },
          {
            key: file.hash,
            value: fileVal
          }
        ], () => {
          this.emit('file-add', fileVal, { key, header });
          resolve({ key, header, file: fileVal });
        });

      } else {
        let bytes = '';
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256');
        const calcHash = new stream.Transform({
          transform
        });
      
        function transform(chunk, encoding, callback) {
          bytes += chunk.toString().length;
          hash.update(chunk);
          callback(null, chunk);
        }

        pump(readStream, calcHash, writeStream, async () => {
          const _hash = hash.digest('hex');
          const file = {
            name: fileName,
            size: bytes,
            mimetype: fileExt,
            path: filePath,
            encrypted: false,
            hash: _hash,
            key: hyperFile.key.toString('hex')
          }
          this.db.batch([
            {
              key: filePath,
              value: {
                hash: _hash
              }
            },
            {
              key: _hash,
              value: file
            }
          ], () => {
            this.emit('file-add', file);
            resolve({ file })
          });
        });
      }
    });
  }

  async readFile(filePathOrHash, opts) {
    return new Promise(async (resolve, reject) => {
      this.db.get(filePathOrHash, (err, item) => {
        if(err) return reject(err);

        if(item.value.hash) {
          this.db.get(item.value.hash, (err, itm) => {
            if(err) return reject (err);
            const feed = this.hyperstore[itm.value.path];

            // Get file stream from hypercore
            const stream = feed.createReadStream();

            // If key and header passed in then decipher file
            if(opts && opts.key && opts.header) {
              const decryptedStream = Crypto.decryptStream(stream, { key: opts.key, header: opts.header, start: 24 });
              resolve(decryptedStream);
            } else {  
              resolve(stream);
            }
          });
        }
      });
    });
  }

  async unlink(filePathOrHash) {
    return new Promise(async (resolve, reject) => {
      let file;

      this.db.get(filePathOrHash, async (err, item) => {
        if(err) return reject(err);

        if(item.value.hash) {
          this.db.get(item.value.hash, async (err, itm) => {
            if(err) return reject(err);
            
            file = itm.value;

            this.db.batch([
              {
                type: 'del',
                key: item.key
              },
              {
                type: 'del',
                key: itm.value.path
              }
            ], async () => {
              await this._destroyStorage(file.path);
              this.emit('file-unlink', file);
              resolve(file);
            });
          });
        } else {
          file = item.value;

          this.db.batch([
            {
              type: 'del',
              key: item.key
            },
            {
              type: 'del',
              key: item.value.path
            }
          ], async () => {
            await this._destroyStorage(file.path);
            this.emit('file-unlink', file);
            resolve(file);
          });
        }
      });
    });
  }

  async _destroyStorage(filePath) {
    const hypercore = this.hyperstore[filePath];

    if(hypercore) {
      await hypercore.destroyStorage()
      delete this.hyperstore[filePath];
    }
  }

  async _initHyperstore() {
    const asyncArr = [];
    this.hyperdb = level(path.join(this.metaPath, '/hyperstore'), { valueEncoding: 'json' });

    return new Promise((resolve, reject) => {
      this.hyperdb.createReadStream()
        .on('data', (data) => {
          if(data.value.type === 'hypercore') {
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

  async _getHyperFile(filePath, fileHash, opts) {
    const { Hypercore } = this.sdk;
    const keyOrName = opts.feedKey ? `hyper://${opts.feedKey}` : filePath;

    return new Promise(async (resolve, reject) => {
      this.hyperdb.get(filePath, async (err, value) => {

        if(value && this.hyperstore[filePath]) {
          return resolve(this.hyperstore[filePath]);
        }
      
        const hyperFile = new Hypercore(keyOrName, { persist: true, sparse: false });
        await hyperFile.ready();

        this.hyperstore[filePath] = hyperFile;

        // If this is a remote feed then wait until it data has been downloaded
        if(!hyperFile.writable) {
          let blockCnt = 0;
  
          hyperFile.on('download', async() => {
            blockCnt += 1;

            if(blockCnt === hyperFile.length) {
              // Audit file - Check given hash matches
              if(fileHash) {
                const stream = hyperFile.createReadStream();

                try {
                  await auditFile(stream, fileHash);
                } catch(err) {
                  await hyperFile.destroyStorage();
                  return this.emit('file-error', err);
                }
              }

              this.emit('file-download', null, { path: filePath, hash: fileHash });
              resolve(hyperFile);
            }
          });
        } else {
          if(!value) {
            // TODO: Replace with hypertrie?
            this.hyperdb.put(filePath, { 
              type: 'hypercore',
              key: hyperFile.key.toString('hex'),
              replicate: !!opts.replicate
            });
          }

          this.emit('file-download', null, { path: filePath, hash: fileHash });
          resolve(hyperFile);
        }
      });
    });
  }

  /**
   * Connect as a client and request to download files
   */
  async download(discoveryKey, files) {
    let connected = false;
    const fileRequests = [];

    const swarm = new Swarm({
      keyPair: this.keyPair,
      topic: discoveryKey,
      lookup: true,
      announce: false
    });

    return new Promise((resolve, reject) => {
      swarm.once('peer-add', p => {
        const plex = p2plex();
        plex.join(Buffer.from(p.publicKey, 'hex'), { announce: false, lookup: true });

        process.nextTick(() => {
          plex.on('connection', async peer => {
            if(peer.publicKey.toString('hex') !== p.publicKey && !connected) {
              connected = true;
              
              peer.createStream('request').end(JSON.stringify({ 
                discoveryKey,
                files, 
                peerPubKey: this.keyPair.publicKey 
              }));

              // Open up a new stream to listen for each file requested
              for(let file of files) {
                fileRequests.push(new Promise((res, rej) => {
                  const stream = peer.receiveStream(file.hash);
                  let message = '';

                  stream.on('data', (chunk) => {
                    message += chunk.toString('utf-8')
                  });

                  stream.on('end', async () => {
                    const fileMeta = JSON.parse(message);
                    if(fileMeta.error) {
                      this.emit('file-download', fileMeta.error, null);
                      return res();
                    }
                    
                    await this._getHyperFile(fileMeta.path, file.hash, { feedKey: fileMeta.key })
                    res();
                  })
                }));
              }

              try {
                await Promise.all(fileRequests);
                await swarm.close();
                plex.destroy();
                this.emit('download-finished');
              } catch (err) {
                this.emit('download-error', err);
              }
              
              resolve();
            }
          });
        });

        setTimeout(async () => {
          if(!connected) {
            plex.destroy();
            reject('error', 'Failed to connect to any peers within the alotted time.');
          }
        }, 5000);
      });
    });
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
    await this.sdk.close();

    this.openend = false;
  }
}

function createTopicHash(topic) {
  const crypto = require('crypto');
    
  return crypto.createHash('sha256')
    .update(topic)
    .digest();
}

async function auditFile(stream, remoteHash) {
  const crypto = require('crypto');
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');

    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => {
      const localHash = hash.digest('hex');
      if(localHash === remoteHash)
        return resolve()
      
      reject('Hashes do not match');
    });
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