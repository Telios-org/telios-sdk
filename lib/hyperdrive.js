const SDK = require('dat-sdk');
const Crypto = require('../util/crypto');
const { parser } = require('../util/mailparser');

class Hyperdrive {
  constructor(opts) {
    this.name = opts.name;
    this.storage = opts.storage;
    this.opts = opts.driveOpts;
    this.drive = null;
    this.close = null;
  }

  async connect() {
    try {
      const sdk = await SDK({
        storage: this.opts.persist ? this.storage : null
      });

      const { Hyperdrive } = sdk;
      const drive = Hyperdrive(this.name, {
        driveOpts: this.opts
      });
      await drive.ready();
      this.drive = drive;
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

  async readEncryptedMail(meta) {
    await this.drive.download(meta.path);

    return new Promise(async(resolve, reject) => {
      this.drive.on('update', async () => {
        const mail = await this.drive.readFile(meta.path);
        const decrypted = Crypto.decryptAED(meta.key, meta.pub, mail);
        await this.drive.destroyStorage();
        resolve(JSON.parse(decrypted.toString('utf-8')));
      });
    });
    
  }

  async readEncryptedStream(meta) {
    await this.drive.download(meta.path);
    
    return new Promise((resolve, reject) => {
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
          message = Buffer.concat([message, Crypto.secretStreamPull(chunk, state)]);
          data += message.toString();
        });

      
        stream.on('end', async () => {
          await this.drive.destroyStorage();
          resolve(await parser(data));
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
}

module.exports = Hyperdrive;