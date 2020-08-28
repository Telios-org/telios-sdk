const SDK = require('dat-sdk');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');

class HyperSession {
  constructor() {
    this.sessions = [];
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

    return session;
  }

  async resume(sessionName) {
    let session = null;

    for (let i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].name === sessionName) {
        const { Core, Drive } = await this._initDriveCore(this.sessions[i].sdk, this.sessions[i].opts);
        this.sessions[i].status = 'open';
        this.sessions[i].Hypercore = Core;
        this.sessions[i].Hyperdrive = Drive;
        session = this.sessions[i];
      }
    }

    return session;
  }

  async close() {
    const sessions = [];

    for (let i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].status === 'open') {
        
        if (this.sessions[i].Hypercore) {
          await this.sessions[i].Hypercore.feed.close();
        }
        
        if (this.sessions[i].Hyperdrive) {
          await this.sessions[i].Hyperdrive.drive.close();
        }
        
        this.sessions[i].status = 'closed';
        sessions.push(this.sessions[i]);
      }
    }

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