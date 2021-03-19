const fs = require('fs');
const path = require('path');
const MultiHyperbee = require('multi-hyperbee');
const Hyperdrive = require('hyperdrive');
const pump = require('pump');
const sodium = require('sodium-native');
const Crypto = require('./crypto');
const Swarm = require('./drive.swarm');
const chokidar = require('chokidar');
const p2plex = require('p2plex');
const level = require('level');
const rimraf = require('rimraf');
const stream = require('stream');
const EventEmitter = require('events');
const { resolve } = require('path');

const DEFAULT_OPTS = {
  ephemeral: true,
  writable: true
}

class Drive extends EventEmitter {
  constructor(drivePath, publicKey, { keyPair, ignore, ephemeral, writable }) {
    super();

    // Store for hyperdrives
    this.corestore = [];
    // Key used to clone and seed drive. Should only be shared with trusted sources
    this.publicKey = publicKey;
    // P2P DB
    this.db = null;
    // Drive owner keypair
    this.keyPair = keyPair;
    // Set ephemeral to false if hosting this drive from a server in conjunction with
    // a lot of other drives. This will prevent hyperswarm from joining and creating
    // event listeners for each drive and instead provide the option for the server to
    // define how it connects and listens to the network.
    this.ephemeral = typeof ephemeral !== 'undefined' ? ephemeral : DEFAULT_OPTS.ephemeral;
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

    if(!fs.existsSync(drivePath)) {
      fs.mkdirSync(drivePath);
      fs.mkdirSync(drivePath + '/.drive');
      this._create = true;
    }

    // If there aren't any Hyperbee DBs then bootstrap new drive
    if(fs.existsSync(path.join(drivePath, '/.drive')) && 
      !fs.existsSync(path.join(drivePath,'/.drive/db'))
    ) {
      this._create = true;
    }
  }

  async ready() {
    // this.db = new MultiHyperbee(path.join(`${this.metaPath}`, '/db'), { keyEncoding: 'utf-8', valueEncoding: 'json' });
    // this._diffHyperbee = await this.db.getDiff();
    // this.diffFeedKey = this._diffHyperbee.feed.key.toString('hex');

    // await this.db.ready();

    // // Create and bootstrap new drive
    // if (this._create && !this.publicKey) {
    //   await this._init();
    // }

    // // Reconnect existing drive
    // if(!this._create) {
    //   const publicKey = await this.db.get('__publicKey');

    //   //TODO: Clean this up
    //   if(publicKey) {
    //     this.publicKey = publicKey.value.key;
    //   }

    //   this.discoveryKey = createTopicHash(this.publicKey).toString('hex');
    // }

    // /**
    //  * Set writable to false on drives that just seed content and don't intend to write or
    //  * have write access. If the other peer drives don't recognize this drive as another writer,
    //  * then any updates this drive makes will be overwritten by the other peers. In order to maintain 
    //  * an access policy, non-writable peers will need to store which peers can write to this drive locally.
    //  * 
    //  * TODO: Should probably encrypt this.
    //  */
    // if(!this.writable) {
    //   this.slaveDB = level(path.join(this.metaPath, '/access'), { valueEncoding: 'json' });

    //   try {
    //     const canWrite = await this.slaveDB.get('canWrite');
    //     this.db.addWriters(canWrite);
    //   } catch(err) {
    //     await this.slaveDB.put('canWrite', []);
    //   }
    // }

    /**
     * Setting the drive to ephemeral will announce it's presence to other peers (clients and other replicating peers) connected
     * to the same hyperswarm topic, and allow them to request and download files this drive has.
     */
    if(this.ephemeral) {
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

            if(!_file || !fs.existsSync(path.join(this.drivePath, _file.value.filename))) {
              resolve();
            }
            
            const stream = peer.createStream(file.hash).end(JSON.stringify({ drive: _file.drive }));

            pump(rs, stream, async () => {
              resolve();
            });
          }))
        }

        await Promise.all(fileRequests);
      });
    

      // const replicate = new Swarm({
      //   keyPair: this.keyPair,
      //   db: this.db,
      //   topic: this.publicKey,
      //   lookup: true,
      //   announce: true
      // });
      // this._connections.push(replicate);

      // this._connectClient();
    }
    
    this.opened = true;
  }

  /**
   * Add a file as a hyperdrive
   */
  async writeFile(fileName, readStream) {
    return new Promise((resolve, reject) => {
      const drive = Hyperdrive(path.join(this.drivePath, `/${fileName}`));

      drive.on('ready', () => {
        const writeStream = drive.createWriteStream(`/${fileName}`);

        pump(readStream, writeStream, () => {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256');
          const stream = drive.createReadStream(`/${fileName}`);

          stream.on('error', err => reject(err));
          stream.on('data', chunk => hash.update(chunk));
          stream.on('end', async () => {
            const _hash = hash.digest('hex');

            await this.db.put(fileName, {
              hash: _hash
            });
            await this.db.put(_hash, {
              fileName,
              hash: _hash,
              path: '/',
              drive: drive.key.toString('hex')
            });
            resolve(_hash)
          });
        });
      });
    });
  }

  /**
   * Connect as a client and request to download files
   */
  static download(discoveryKey, files, { keyPair }) {
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
              fileRequests.push(new Promise((res, rej) => {
                const stream = peer.receiveStream(file.hash);
                let message = '';

                stream.on('data', (chunk) => {
                  message += chunk.toString('utf8')
                });

                stream.on('end', () => {
                  const remoteDriveKey = JSON.parse(message).drive;
                  //TODO: Connect to hyperdrive and download file
                  resolve(remoteDriveKey);
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