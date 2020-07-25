const callout = require('./callout');
const routes = require('../routes');
const Client = require('./client');
const Hyperdrive = require('./hyperdrive');
const Crypto = require('../util/crypto');

class Mailbox extends Client {
  constructor(opts) {
    super(opts);
  }

  registerMailbox(payload) {    
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register
    });
  }

  createAlias() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register_alias
    });
  }

  removeAlias() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register_alias
    });
  }

  getMailboxPubKey(addr) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_public_key,
      param: addr
    });
  }

  async getNewMail(sbpkey, privKey) {
    const newMail = await this._getNewMailMeta();
    const promises = [];

    for (let i = 0; i < newMail.data.length; i++) {
      promises.push(this._decryptMail(newMail.data[i].msg, sbpkey, privKey));
    }

    return Promise.all(promises);
  }

  _getNewMailMeta() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_new_mail
    });
  }

  async _decryptMail(encMeta, sbpkey, privKey) {
    const meta = JSON.parse(Crypto.decryptMessage(encMeta, sbpkey, privKey));
    const hyperdrive = new Hyperdrive(meta.drive, { persist: false });
    await hyperdrive.connect();
    return hyperdrive.readEncryptedMail(meta);
  }

  send(email) {
    
  }

  sendMailMeta(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.send_encrypted_mail
    });
  }

  static _encryptMail(email, privKey) {
    const meta = email;

    // loop through recipients and get sbpkey

    const encrypted = null // TODO: add this _encryptMeta(meta, sbpkey, privKey)
    
    return encrypted; // Return encrypted metadata
  }

  static _encryptMeta(meta, sbpkey, privKey) {
    return Crypto.encryptMessage(JSON.stringify(meta), sbpkey, privKey);
  }

  markAsRead(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.mark_as_read
    });
  }
}

module.exports = Mailbox;