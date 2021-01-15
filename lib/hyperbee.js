const Crypto = require('./crypto');
const MultiHyperbee = require('multi-hyperbee');

class Hyperbee {
  constructor(storage, keypair) {
    this.db = new MultiHyperbee(storage, {
      keyEncoding: 'utf-8', // can be set to undefined (binary), utf-8, ascii or and abstract-encoding
      valueEncoding: 'json' // same options as above
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
      value.data = Crypto.encryptSBMessage(value.data, this.pubKey, this.privKey).toString('hex');
    }

    return this.db.put(key, value);
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
      return Crypto.decryptSBMessage(value.data, this.pubKey, this.privKey);
    }

    const { value } = await this.db.get(key);
    return value;
  }
}

module.exports = Hyperbee;