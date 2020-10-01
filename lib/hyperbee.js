const hyperbee = require('hyperbee');
const Crypto = require('../util/crypto');

class Hyperbee {
  constructor(keypair, feed) {
    this.db = new hyperbee(feed, {
      keyEncoding: 'binary', // can be set to undefined (binary), utf-8, ascii or and abstract-encoding
      valueEncoding: 'binary' // same options as above
    });
    this.privKey = keypair && keypair.privateKey ? keypair.privateKey : null;
    this.pubKey = keypair && keypair.publicKey ? keypair.publicKey : null;
  }

  async put(key, value) {
    this.privKeyIsSet();
    const encKey = Crypto.encryptSBMessage(key, this.pubKey, this.privKey);
    const encVal = Crypto.encryptSBMessage(value, this.pubKey, this.privKey);
    await this.db.put(encKey.toString('hex'), encVal.toString('hex'));
  }

  async del(key) {
    this.privKeyIsSet();
    const encKey = Crypto.encryptSBMessage(key, this.pubKey, this.privKey);
    await this.db.del(encKey);
  }

  async get(key) {
    this.privKeyIsSet();
    const encKey = Crypto.encryptSBMessage(key, this.pubKey, this.privKey);
    const { value } = await this.db.get(encKey);
    return Crypto.decryptSBMessage(value.toString('utf-8'), this.pubKey, this.privKey);
  }

  privKeyIsSet() {
    if (!this.privKey) throw 'Private Key cannot be null.';
    return true;
  }
}

module.exports = Hyperbee;