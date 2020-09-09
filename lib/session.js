const SDK = require('dat-sdk');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');

class HyperSession {
  constructor() {
    this.sessions = [];
    this.active = null;
  }

  async add(sessionName, opts) {
    if (!opts.sdk) {
      opts.sdk = await SDK({
        storage: opts.storage
      });
    }
    
    const { Core, Drive } = await this._initDriveCore(opts.sdk, opts);

    const session = {
      status: 'open',
      name: sessionName,
      sdk: opts.sdk,
      Hypercore: Core,
      Hyperdrive: Drive,
      opts: opts
    }

    this.sessions.push(session);
    this.active = session;

    return session;
  }

  async resume(sessionName) {
    let session = null;

    for (let i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].name === sessionName) {
        this.sessions[i].status = 'open';
        session = this.sessions[i];
        this.active = session;
      }
    }

    return session;
  }

  getActive() {
    return this.active;
  }

  async close() {
    const sessions = [];

    for (let i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].status === 'open') {
        this.sessions[i].status = 'closed';
      }
    }
    this.active = null;
    return sessions;
  }

  async _initDriveCore(sdk, opts) {
    let Drive = null;
    let Core = null;

    // Init Hyperdrive
    if (opts.Hyperdrive) {
      const driveOpts = {
        name: opts.Hyperdrive.name,
        sdk: sdk,
        driveOpts: opts.Hyperdrive.opts
      };

      const hyperdrive = new Hyperdrive(driveOpts);
      await hyperdrive.connect();
      Drive = hyperdrive;
    }

    // Init Hypercore
    if (opts.Hypercore) {
      const coreOpts = {
        name: opts.Hypercore.name,
        sdk: sdk,
        coreOpts: opts.Hypercore.opts
      };

      const hypercore = new Hypercore(coreOpts);
      await hypercore.connect();
      Core = hypercore;
    }

    if (opts.Hypercore && opts.Hypercore.ext) {
      const ext = await Core.feed.registerExtension(opts.Hypercore.ext.name, {
        encoding: opts.Hypercore.ext.encoding,
        onmessage: opts.Hypercore.ext.onmessage
      });
    }

    return {
      Drive: Drive,
      Core: Core
    }
  }
  
}

module.exports = HyperSession;