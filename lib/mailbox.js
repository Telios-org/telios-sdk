const callout = require('./callout');
const routes = require('../routes');
const Client = require('./client');
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
    const mailArr = [];

    for (let i = 0; i < newMail.data.length; i++) {
      mailArr.push(this._decryptMeta(newMail.data[i].msg, sbpkey, privKey));
    }

    return mailArr;
  }

  _getNewMailMeta() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_new_mail
    });
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

  markAsRead(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.mark_as_read
    });
  }

  static _encryptMailMsg(meta) {
    return meta;
  }

  static _encryptMeta(meta, sbpkey, privKey) {
    return Crypto.encryptMessage(JSON.stringify(meta), sbpkey, privKey);
  }

  _decryptMail(meta) {
    // get encrypted message from hyperdrive

    // decrypt message

    // send any errors to the mail array
    return meta
  }

  _decryptMeta(meta, sbpkey, privKey) {
    return this._decryptMail(JSON.parse(Crypto.decryptMessage(meta, sbpkey, privKey)));
  }
}

module.exports = Mailbox;