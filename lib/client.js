class Client {
  constructor(opts) {
    this.provider = 'https://' + opts.provider;
    this.opts = opts;
  }
}

module.exports = Client;