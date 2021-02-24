const EventEmitter = require('events');
const fs = require('fs');
const MultiHyperbee = require('multi-hyperbee');
const pump = require('pump');
const hyperswarm = require('hyperswarm');
const sodium = require('sodium-native');
const Crypto = require('./crypto');
const chokidar = require('chokidar');

class Drive extends EventEmitter {
  constructor({ keypair, metaPath, drivePath, ignore, live, watch, peers, createNew, network }) {
    super();

    this.new = createNew;

    if (typeof metaPath === 'string' && !fs.existsSync(metaPath)) {
      fs.mkdirSync(metaPath);
    }
    
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
        topic: this.publicTopic,
        lookup: !this.network ? true : false,
        announce: true,
      });

      // Access control
      this.startSwarm({
        topic: this.secretTopic,
        lookup: !this.network ? true : false,
        announce: true,
      });
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
    const files = fs.readdirSync(this.drivePath);
    await this.virtualize(files);
    await this.db.put('publicTopic', { key: this.publicTopic });
    await this.db.put('owner', { key: this.ownerKeypair.publicKey });
    await this.db.put(this.ownerKeypair.publicKey, {
      topic: Crypto.encryptSBMessage(this.secretTopic, this.ownerKeypair.publicKey, this.ownerKeypair.privateKey).toString('hex'),
    });
  
    for (var i = 0; i < this.peers.length; i += 1) {
      await this.db.put(this.peers[i].key, {
        topic: Crypto.encryptSBMessage(this.secretTopic, this.peers[i].key, this.ownerKeypair.privateKey).toString('hex')
      });
    }
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
    for (let i = 0; i < this.network.peers.length; i++) {
      await this.db.addPeer(this.network.peers[i]);
    }
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

    rs.on('data', data => {

    });
  }

  // Close drive and disconnect from Hyperswarm
  async close() {

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
                name: file,
                owner: {
                  key: this.ownerKeypair.publicKey,
                  sig: Crypto.signDetached(hash, this.ownerKeypair.privateKey)
                },
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
        this.emit('connection', info);
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