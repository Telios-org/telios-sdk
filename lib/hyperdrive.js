const Crypto = require('../util/crypto');

class Hyperdrive {
  constructor(opts) {
    this.sdk = opts.sdk;
    this.name = opts.name;
    this.opts = opts.driveOpts;
    this.drive = null;
    this.close = null;
  }

  async connect() {
    try {
      const { Hyperdrive, close } = this.sdk;
      const drive = Hyperdrive(this.name, {
        driveOpts: this.driveOpts
      });
      await drive.ready();
      this.close = close;
      this.drive = drive;
      return drive;
    } catch (err) {
      throw err;
    }
  }

  dirExists(dir) {
    return new Promise((resolve, reject) => {
      this.drive.exists(dir, (bool) => {
        resolve(bool);
      });
    });
  }

  async getDrive(opts) {
    const { Hyperdrive } = this.sdk;
    const drive = new Hyperdrive(opts.name, {
      driveOpts: opts
    });
    await drive.ready();
    return drive;
  }

  async readEncryptedMail(meta) {
    await this.drive.download(meta.path);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject('Failed to make a connection during the time window.');
      }, 5000);
      
      this.drive.on('update', async () => {
        const mail = await this.drive.readFile(meta.path);
        const decrypted = Crypto.decryptAED(meta.key, meta.pub, mail);
        await this.drive.destroyStorage();
        resolve(JSON.parse(decrypted.toString('utf-8')));
      });
    });
    
  }

  async readEncryptedStream(meta, parseMail) {
    await this.drive.download(meta.path);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject('Failed to make a connection during the time window.');
      }, 5000);

      this.drive.on('update', async () => {
        const stream = this.drive.createReadStream(meta.path, {
          start: 24 // Skip the header bytes
        });

        const key = Buffer.from(meta.key, 'hex');
        let header = Buffer.from(meta.header, 'hex');
        let message = Buffer.from([]);
        let state = Crypto.initStreamPullState(header, key);
        let data = '';

        stream.on('data', function (chunk) {
          message = Crypto.secretStreamPull(chunk, state);
          data += message.toString();
        });

      
        stream.on('end', async () => {
          await this.drive.destroyStorage();
          resolve(data);
        });

        stream.on('error', async (err) => {
          await this.drive.destroyStorage();
          reject(err);
        });
      });
    });
  }

  async saveEncryptedStream(filePath, writeStream) {
    const BUFFER_SIZE = 8192;

    const readStream = fs.createReadStream(filePath, { highWaterMark: BUFFER_SIZE });
    const key = Crypto.generateStreamKey();
    let { state, header } = Crypto.initStreamPushState(key);
    writeStream.write(header);

    // This will wait until we know the readable stream is actually valid before piping
    readStream.on('data', function (chunk) {
      const data = Crypto.secretStreamPush(chunk, state);
      writeStream.write(data);
    });

    return new Promise((resolve, reject) => {
      readStream.on('close', function () {
        writeStream.destroy();
        resolve({ key: key.toString('hex'), header: header.toString('hex')});
      });

      readStream.on('error', function (err) {
        console.log('STREAM ERROR :: ', err);
        reject(err);
      });
    });
  }

  removeFile(path) {
    return new Promise(async (resolve, reject) => {
      isDownloaded(this.drive, path, async (err, feed) => {
        if (err) reject(err);

        try {
          await this.drive.unlink(path);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
    

    function isDownloaded (drive, file, cb) {
      return drive.stat(file, { file: true }, (err, stat, trie) => {
        if (err) return cb(err)
        getFeed(drive, stat, trie, (err, feed) => {
          if (err) return cb(err)
          cb(null, feed.clear(stat.offset, stat.offset + stat.blocks))
        })
      })
    }

    function getFeed (drive, stat, trie, cb) {
      if (stat.mount && stat.hypercore) {
        const feed = drive.corestore.get({
          key: stat.mount.key,
          sparse: drive.sparse
        })

        feed.ready((err) => {
          if (err) return cb(err)
          stat.blocks = feed.length
          cb(null, feed)
        })
      } else {
        drive._getContent(trie.feed, (err, contentState) => {
          if (err) return cb(err)
          cb(null, contentState.feed)
        })
      }
    }
  }
}

module.exports = Hyperdrive;