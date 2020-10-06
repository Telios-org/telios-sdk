const SDK = require('dat-sdk');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');
const Hyperbee = require('./hyperbee');

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
    
    const { cores, drives } = await this._init(opts.sdk, opts);

    const session = {
      status: 'open',
      name: sessionName,
      sdk: opts.sdk,
      opts: opts,
      cores,
      drives
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
    for (let i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].status === 'open') {
        this.sessions[i].status = 'closed';
      }
    }
    this.active = null;
    return [...this.sessions];
  }

  async _init(sdk, opts) {
    let cores = [];
    let drives = [];

    // Load Hyperbee DB for Cores
    if (opts.cores) {
      cores = await this._seed(sdk, opts.cores);
    }

    // Load Hyperbee DB for Drives
    if (opts.drives) {
      drives = await this._seed(sdk, opts.drives);
    }

    return {
      cores,
      drives
    };
  }

  async _seed(sdk, opts) {
    const seedList = [];
    const promises = [];
    const coreOpts = {
      name: opts.name,
      sdk: sdk,
      coreOpts: opts.coreOpts
    };

    const cores = new Hypercore(coreOpts);
    await cores.connect();

    const hyperbee = new Hyperbee(cores.feed, opts.keypair);
    await hyperbee.ready();

    // Iterate and open cores
    const coresStream = hyperbee.db.createReadStream();
  
    coresStream.on('data', (data) => {
      const { value } = data;
      const item = JSON.parse(value.toString());

      if (item.seed && item.type === 'hypercore') {
        const hypercore = new Hypercore({
          name: item.name,
          sdk: sdk,
          coreOpts: {
            persist: true
          }
        });

        const promise = new Promise(async (resolve, reject) => {
          const feed = await hypercore.connect();
          resolve(feed);
        });
        
        promises.push(promise);
      }

      if (item.seed && item.type === 'hyperdrive') {
        const hyperdrive = new Hyperdrive({
          name: item.name,
          sdk: sdk,
          driveOpts: {
            persist: true
          }
        });

        const promise = new Promise(async (resolve, reject) => {
          const drive = await hyperdrive.connect();
          resolve(drive);
        });
        
        promises.push(promise);
      }
    });
  
    return new Promise((resolve, reject) => {
      coresStream.on('end', () => {
        Promise.all(promises)
          .then(items => {
            for (let i = 0; i < items.length; i++) {
              if (items[i].opened) {
                seedList.push(items[i]);
              }
            }
            resolve(seedList);
          })
          .catch(err => {
            reject(err);
          });
      });
    });
  }
}

module.exports = HyperSession;