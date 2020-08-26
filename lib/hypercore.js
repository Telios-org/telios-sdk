class Hypercore {
  constructor(opts) {
    this.sdk = opts.sdk;
    this.name = opts.name;
    this.coreOpts = opts.coreOpts;
    this.feed = null;
    this.close = null;
  }

  async connect() {
    const { Hypercore, close } = this.sdk;

    const feed = Hypercore(this.name, { coreOpts: this.coreOpts });
    await feed.ready();
    this.feed = feed;
    this.close = close;
    return feed;
  }

  async getCore(opts) {
    const { Hypercore } = this.sdk;
    const feed = new Hypercore(opts.name, {
      coreOpts: opts.coreOpts
    });
    await feed.ready();
    return feed;
  }
}

module.exports = Hypercore;