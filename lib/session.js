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
    
    const { HyperDB, Corestore } = await this._init(opts.sdk, opts);

    const session = {
      status: 'open',
      name: sessionName,
      sdk: opts.sdk,
      opts: opts,
      HyperDB,
      Corestore
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
    const asyncDBArr = [];
    const HyperDB = await this._initDatabases(sdk, {
      databases: opts.databases,
      keypair: opts.keypair
    });

    for (let i = 0; i < opts.bootstrap.length; i += 1) {
      asyncDBArr.push(this._bootstrap(HyperDB[opts.bootstrap[i]], sdk));
    }
    
    return Promise.all(asyncDBArr)
      .then(arr => {
        const coreMap = {};

        arr.forEach(item => {
          coreMap[item.name] = item.coreMap;
        });
        return { HyperDB, Corestore: coreMap};
      }).catch(err => {
        return err;
      });
  }

  _initDatabases(sdk, opts) {
    let dbArr = [];
    for (let i = 0; i < opts.databases.length; i += 1) {
      const promise = new Promise(async (resolve, reject) => {
        try {
          const coreOpts = {
            name: opts.databases[i],
            keypair: opts.keypair,
            sdk,
            coreOpts: {
              persist: true
            }
          };
            
          const core = new Hypercore(coreOpts);
          const feed = await core.connect();
          const hyperDB = new Hyperbee(feed, opts.keypair);
          await hyperDB.ready();
          return resolve({ ...hyperDB, name: opts.databases[i] });
        } catch (err) {
          return reject(err);
        }
      });
      dbArr.push(promise);
    }

    return Promise.all(dbArr)
      .then((arr) => {
        let HyperDB = {};
        for (let i = 0; i < arr.length; i += 1) {
          HyperDB[arr[i].name] = arr[i];
        }
        return HyperDB;
      });
  }

  async _bootstrap(HyperDB, sdk) {
    const asyncArr = [];

    // Iterate and open cores
    const coresStream = HyperDB.db.createReadStream();

    coresStream.on('data', async (data) => {
      const { value } = data;
      const item = JSON.parse(value.toString());
      if (item.announce && item.type === 'hypercore') {
        const hypercore = new Hypercore({
          name: item.name,
          sdk: sdk,
          coreOpts: {
            persist: true
          }
        });

        const promise = new Promise(async (resolve, reject) => {
          await hypercore.connect();
          resolve({ ...hypercore, name: item.name, dbName: HyperDB.name });
        });
        
        asyncArr.push(promise);
      }

      if (item.announce && item.type === 'hyperdrive') {
        const hyperdrive = new Hyperdrive({
          name: item.name,
          sdk: sdk,
          driveOpts: {
            persist: true
          }
        });

        const promise = new Promise(async (resolve, reject) => {
          await hyperdrive.connect();
          resolve({ ...hyperdrive, name: item.name, dbName: HyperDB.name });
        });
        
        asyncArr.push(promise);
      }
    });
  
    return new Promise((resolve, reject) => {
      let coreMap = {};
      coresStream.on('end', () => {
        Promise.all(asyncArr)
          .then(items => {
            
            for (let i = 0; i < items.length; i += 1) {
              if (items[i].drive && items[i].drive.opened || items[i].feed && items[i].feed.opened) {
                coreMap[items[i].name] = items[i];
              }
            }
            return resolve({ name: items[0].dbName, coreMap });
          })
          .catch(err => {
            console.log(err);
            return reject(err);
          });
      });
    });
  }
}

module.exports = HyperSession;