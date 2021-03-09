const EventEmitter = require('events');
const crypto = require('crypto');

class Client extends EventEmitter {
  constructor(opts) {
    super();

    this.provider = opts.provider;
    this.opts = opts;
  }
}

module.exports = Client;