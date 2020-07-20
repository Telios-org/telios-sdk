const callout = require('./callout');
const routes = require('../routes');

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

  }

  removeAlias() {

  }

  createMessage() {

  }

  postMessage() {

  }

  getUnreadMail() {

  }

  markMailAsRead() {
    
  }
}

module.exports = Mailbox;