const SDK = require('dat-sdk');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');

class Config {
  constructor(opts) {
    this.storage = opts.storage;
    this.core = opts.Hypercore || null;
    this.drive = opts.Hyperdrive || null;
    this.Hyperdrive = null;
    this.Hypercore = null;
  }

  async ready() {
    const sdk = await SDK({
      storage: this.storage
    });

    // Init Hyperdrive
    if (this.drive) {
      const driveOpts = {
        name: this.drive.name,
        sdk: sdk,
        driveOpts: this.drive.opts
      };

      const hyperdrive = new Hyperdrive(driveOpts);
      await hyperdrive.connect();
      this.Hyperdrive = hyperdrive;
    }

    // Init Hypercore
    if (this.core) {
      const coreOpts = {
        name: this.core.name,
        sdk: sdk,
        coreOpts: this.core.opts
      };

      const hypercore = new Hypercore(coreOpts);
      await hypercore.connect();
      this.Hypercore = hypercore;
    }

    return {
      Hypercore: this.Hypercore,
      Hyperdrive: this.Hyperdrive
    }
  }
}

module.exports = Config;