const SDK = require('dat-sdk');
const Crypto = require('../util/crypto');

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
    const mail = await this.drive.readFile(meta.path);

    const decrypted = Crypto.decryptAED(meta.key, meta.pub, mail);
    return JSON.parse(decrypted.toString('utf-8'));
  }

  async readEncryptedStream(meta) {
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
      console.log(message.toString());
      data += message.toString();
    });

    return new Promise((resolve, reject) => {
      stream.on('close', () => {
        this.drive.close();
        resolve(data);
      });

      stream.on('error', (err) => {
        this.drive.close();
        reject(err);
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