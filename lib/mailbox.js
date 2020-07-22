const callout = require('./callout');
const routes = require('../routes');
const Crypto = require('../util/crypto');

class Mailbox {
  constructor(opts) {
    this.provider = 'https://' + opts.provider;
    this.opts = opts;
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

  getNewMail() {
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

  static _encryptMailMsg(msg) {

  }

  static _decryptMailMsg(msg) {
    
  }

  static _encryptMeta(meta, sbpkey, privKey) {
    return Crypto.encryptMessage(JSON.stringify(meta), sbpkey, privKey);
  }

  static _decryptMeta(encMeta, sbpkey, privKey) {
    return Crypto.decryptMessage(encMeta, sbpkey, privKey);
  }
}

module.exports = Mailbox;