const SDK = require('dat-sdk');

class Hyperdrive {
  constructor(name, opts) {
    this.name = name;
    this.opts = opts;
    this.drive = null;
    this.close = null;
  }

  async createDrive() {
    const sdk = await SDK();
    const { Hyperdrive } = sdk;
    
    const drive = Hyperdrive(this.name, { driveOpts: this.opts });
    await drive.ready();
    this.drive = drive;
    return this.drive;
  }
}

module.exports = Hyperdrive;