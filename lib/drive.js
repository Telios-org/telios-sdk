const EventEmitter = require('events');
const fs = require('fs');
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
  constructor({ keypair, metaPath, drivePath, ignore, live, watch, peers, createNew, network }) {
    super();

    this.new = createNew;

    if (typeof metaPath === 'string' && !fs.existsSync(metaPath)) {
      fs.mkdirSync(metaPath);
    }
    
    this.connectedPeers = [];
    this.ownerKeypair = keypair;
    this.live = live;
    this.watch = watch;
    this.peers = peers;
    this.metaPath = metaPath; // Path where file metadata is stored
    this.drivePath = drivePath; // Path of files to be shared
    this.ignore = ignore; // File pattern to ignore in drivePath
    this.db = null; // Peer DB
    this.diffFeed = null; // Diff DB feed key
    this.network = network;
    this.plex = p2plex({ keyPair: keypair });
    console.log('Plex User : ', this.plex.publicKey.toString('hex'))
    this.secretTopic = network && network.secretTopic ? network.secretTopic : null; // Secret topic shared with peers who can seed and replicate this drive
    this.publicTopic = network && network.publicTopic ? network.publicTopic : null; // Public topic for responding to access requests
  }

  async ready() {
    this.db = new MultiHyperbee(this.metaPath, { keyEncoding: 'utf-8', valueEncoding: 'json' });
    const diffHyperbee = await this.db.getDiff();
    this.diffFeed = diffHyperbee.feed.key.toString('hex');
    
    await this.db.ready();

    if (this.new) {
      // Create and bootstrap new drive
      await this.create();
    } else {
      // Reconnect existing drive
      await this.connect();
    }

    if (this.live) {
      // DB Replication
      this.startSwarm({
        db: this.db,
        topic: this.secretTopic,
        lookup: !this.network ? true : false,
        announce: true,
      });

      // this.plex.on('connection', peer => {
      //   //peer.createSharedStream('request');

      //   //peer.createStream('discovery').end(`Hey its ${this.plex.publicKey.toString('hex')}`)
        
      //   //stream.pipe(process.stdout);
        
      //   // stream.on('data', data => {
      //   //   this.connectedPeers.push(peer.publicKey.toString('hex'));
      //   // });

      //   // process.nextTick(() => {
      //   //   this.connectedPeers.push(peer.publicKey.toString('hex'));
      //   // })
        
      // });

      // Access control
      // this.startSwarm({
      //   topic: this.secretTopic,
      //   lookup: !this.network ? true : false,
      //   announce: true,
      // });
    }

    if (this.watch) {
      this.watchDrive(this.drivePath);
    }
  }

  async create() {
    let secretTopicBuf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
    let publicTopicBuf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
  
    sodium.randombytes_buf(secretTopicBuf);
    sodium.randombytes_buf(publicTopicBuf);
  
    this.secretTopic = secretTopicBuf.toString('hex');
    this.publicTopic = publicTopicBuf.toString('hex');

    
    // TODO: Setup access control
    // const accessList = {
    //   admin: null,
    //   read: null,
    //   write: null,
    //   seed: null
    // }
  
    
    // Virtualize a local directory with or without files after DB is ready
    await this.db.put('publicTopic', { key: this.publicTopic });
    console.log('Put owner key ', this.plex.publicKey.toString('hex'));
    await this.db.put('owner', { key: this.plex.publicKey.toString('hex') });
    await this.db.put(this.ownerKeypair.publicKey, {
      topic: Crypto.encryptSBMessage(this.secretTopic, this.ownerKeypair.publicKey, this.ownerKeypair.privateKey).toString('hex'),
    });
  
    for (var i = 0; i < this.peers.length; i += 1) {
      await this.db.put(this.peers[i].key, {
        topic: Crypto.encryptSBMessage(this.secretTopic, this.peers[i].key, this.ownerKeypair.privateKey).toString('hex')
      });
    }

    const files = fs.readdirSync(this.drivePath);
    await this.virtualize(files);
  }

  async connect() {
    // await this.db.get('publicTopic', { key: this.publicTopic });
    const owner = await this.db.get('owner');
    
    // If you aren't the owner then this is a remote drive
    if (!owner) {
      return await this.seed();
    }

    const publicTopic = await this.db.get('publicTopic');
    this.publicTopic = publicTopic.value.key;
    
    const ownerMeta = await this.db.get(this.ownerKeypair.publicKey);
    this.secretTopic = Crypto.decryptSBMessage(ownerMeta.value.topic, this.ownerKeypair.publicKey, this.ownerKeypair.privateKey);
  }

  // Seed a remote drive
  async seed() {
    const writeList = [];

    for (let i = 0; i < this.network.peers.length; i++) {
      writeList.push(this.network.peers[i]); // Sync updates from peers
      await this.db.addPeer(this.network.peers[i]);
    }

    await this.db.put('canWrite', { peers: writeList });
  }

  async handShake({ announce, lookup }) {
    const crypto = require('crypto');
    
    const topicHex = crypto.createHash('sha256')
      .update('My Secret Topic 11sfa')
      .digest();
    
    this.plex.on('connection', peer => {   
      peer.on('disconnected', (p) => {
        console.log(`${peer.publicKey} peer disconnected`);
      });

      const rs = peer.createSharedStream('request');
      rs.on('data', data => {
        //process.nextTick(() => {
          this.serveFile(data.toString('utf8'), peer.publicKey.toString('hex'));
       // });
      });

      const ss = peer.receiveStream('sync');
      ss.on('data', data => {
        process.nextTick(() => {
          console.log(data.toString('utf8'));
        });
      });
    });
    
    this.plex.join(topicHex, { announce, lookup });
  }

  // Watch for file changes on the drive
  watchDrive() {
    // Initialize local watcher.
    const watcher = chokidar.watch(this.drivePath, {
      ignored: this.ignore ? this.ignore : /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    watcher
      .on('add', path => this.emit('add', `File ${path} has been added`))
      .on('change', path => this.emit('change', `File ${path} has been changed`))
      .on('unlink', path => this.emit('delete', `File ${path} has been removed`));
    
    // Watch for remote changes
    const rs = this.db.createHistoryStream({ live: true, gte: -1 });
    const memStream = new MemoryStream();
    

    rs.on('data', async data => {
      if (data.value.filename && this.network) {
        const ws = fs.createWriteStream(`${this.drivePath}/${data.value.filename}`);
        const beam = new Hyperbeam(data.value.hash);
        
        beam.on('data', (data) => {
          ws.write(data.toString('utf8'));
        });

        // Request file from peers
        this.plex.peers.forEach(peer => {
          const stream = peer.createStream('request');
          pump(memStream, stream, (err) => {
            console.log(err);
          })
        });

        memStream.write(data.value.hash);
      }
    });
  }

  // Close drive and disconnect from Hyperswarm
  async close() {
    this.plex.destroy();
  }

  async serveFile(hash, peer) {
    console.log(`Serve file : ${hash} to Peer ${peer}`);
    const file = await this.db.get(hash);
    const rs = fs.createReadStream(`${this.drivePath}/${file.value.filename}`);
    
    
    const beam = new Hyperbeam(hash);

    pump(rs, beam, (err) => {
      if (err) throw err;
    });
  }

  async virtualize(files) {
    const asyncArr = [];
    //TODO: Add recursive directories
    files.forEach(file => {
      const filePath = `${this.drivePath}/${file}`;

      asyncArr.push(new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
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
              });
              return resolve();
            })
            .catch(err => {
              return reject(err);
            });
        });
      }));
    });
    await Promise.all(asyncArr);
  }

  startSwarm({ db, topic, lookup, announce }) {
    const crypto = require('crypto');
    const swarm = hyperswarm();

    const topicHex = crypto.createHash('sha256')
      .update(topic)
      .digest();

    swarm.join(topicHex, { lookup, announce });

    swarm.on('connection', async (socket, info) => {
      if (db) {
        let stream = await db.replicate(info.client, { stream: socket, live: true });
        pump(socket, stream, socket);
      }
    });
  }
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