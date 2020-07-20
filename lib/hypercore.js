const SDK = require('dat-sdk');

class Hypercore {
  constructor(name, opts) {
    this.name = name;
    this.opts = opts;
    this.drive = null;
  }

  async createCore() {
    const sdk = await SDK();
    const { Hypercore } = sdk;

    const core = Hypercore(this.name, { coreOpts: this.opts });
    await core.ready();
    this.core = core;
    return this.core;
  }

  static async getCore(name, opts) {
    const sdk = await SDK();
    const { Hypercore } = sdk;

    const core = Hypercore(name, opts);
    await core.ready();
    this.core = core;
    return this.core;
  }
}

module.exports = Hypercore;