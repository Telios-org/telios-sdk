const hyperbee = require('hyperbee');
const Crypto = require('../util/crypto');

class Hyperbee {
  constructor(feed, keypair) {
    this.db = new hyperbee(feed, {
      keyEncoding: 'binary', // can be set to undefined (binary), utf-8, ascii or and abstract-encoding
      valueEncoding: 'binary' // same options as above
    });
    this.privKey = keypair && keypair.privateKey ? keypair.privateKey : null;
    this.pubKey = keypair && keypair.publicKey ? keypair.publicKey : null;
  }

  async ready() {
    await this.db.ready();
  }

  async put(key, value) {
    if (this.pubKey && this.privKey) {
      key = Crypto.encryptSBMessage(key, this.pubKey, this.privKey).toString('hex');
      value = Crypto.encryptSBMessage(value, this.pubKey, this.privKey).toString('hex');
    }
    await this.db.put(key, value);
  }

  async del(key) {
    if (this.pubKey && this.privKey) {
      key = Crypto.encryptSBMessage(key, this.pubKey, this.privKey).toString('hex');
    }
    await this.db.del(key);
  }

  async get(key) {
    if (this.pubKey && this.privKey) {
      key = Crypto.encryptSBMessage(key, this.pubKey, this.privKey);
      const { value } = await this.db.get(key);
      return Crypto.decryptSBMessage(value.toString('utf-8'), this.pubKey, this.privKey);
    }

    const { value } = await this.db.get(key);
    return value;
  }
}

module.exports = Hyperbee;