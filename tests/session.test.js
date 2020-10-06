const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Crypto = require('../util/crypto');
const conf = require('./conf');
const SDK = require('dat-sdk');
const { HyperSession } = require('..');
const { Hyperbee } = require('..');
const { Hypercore } = require('..');
const { Hyperdrive } = require('..');

const hyperSession = new HyperSession();
let CoresDB = null;
let DrivesDB = null;
let sdk = null;

test('HyperSession - Test Setup', async t => {
  t.plan(1);
  let coresPromises = [];
  let drivesPromises = [];

  sdk = await SDK({ storage: __dirname + '/storage/alice' });

  let opts = {
    name: 'Cores',
    sdk: sdk,
    coreOpts: {
      persist: false
    }
  };

  // Create a Hyperbee Database for Cores
  const cores = new Hypercore(opts);
  await cores.connect();
  const coresFeed = cores.feed;
  CoresDB = new Hyperbee(coresFeed, null);

  // Create a Hyperbee Database for Drives
  opts.name = 'Drives';
  const drives = new Hypercore(opts);
  await drives.connect();
  const drivesFeed = drives.feed;
  DrivesDB = new Hyperbee(drivesFeed, null);

  // Generate Hypercores
  for (let i = 0; i < 20; i++) {
    opts.name = `Core ${i}`;
    const hypercore = new Hypercore(opts);
    const promise = new Promise(async (resolve, reject) => {
      const feed = await hypercore.connect();

      const item = {
        name: opts.name,
        type: 'hypercore',
        key: feed.key.toString('hex'),
        announce: true,
        seed: true,
        expires: new Date()
      };

      await CoresDB.put(i.toString(), JSON.stringify(item));
      resolve(feed);
    });

    coresPromises.push(promise);
  }

  // Generate Hyperdrives
  for (let i = 0; i < 20; i++) {
    const driveOpts = {
      name: `Drive ${i}`,
      sdk: sdk,
      driveOpts: {
        persist: false
      }
    };
    
    const hyperdrive = new Hyperdrive(driveOpts);

    const promise = new Promise(async (resolve, reject) => {
      const drive = await hyperdrive.connect();

      const item = {
        name: opts.name,
        type: 'hyperdrive',
        key: drive.key.toString('hex'),
        announce: true,
        seed: true,
        expires: new Date()
      };

      await DrivesDB.put(i.toString(), JSON.stringify(item));
      resolve(drive);
    });

    drivesPromises.push(promise);
  }

  Promise.all([...coresPromises, ...drivesPromises]).then(async (results) => {
    await sdk.close();
    t.ok(results);
  });
});

test('HyperSession - Add a New Session', async t => {
  t.plan(1);

  const session = await hyperSession.add('Alice Session', {  
    storage: __dirname + '/storage/alice',
    databases: [
      'Cores',
      'Drives',
      'Email',
      'Contacts',
      'Files'
    ],
    bootstrap: [
      'Cores',
      'Drives'
    ]
  });

  t.equals(session.status, 'open');
});

test('HyperSession - Close Session', async t => {
  t.plan(1);
  const sessions = await hyperSession.close();
  t.equals(sessions[0].status, 'closed');
});

test('HyperSession - Resume Session', async t => {
  t.plan(7);

  const session = await hyperSession.resume('Alice Session');
  t.equals(session.status, 'open');
  t.ok(session.sdk);
  t.ok(session.HyperDB.Cores);
  t.ok(session.HyperDB.Drives);
  t.ok(session.HyperDB.Email);
  t.ok(session.HyperDB.Contacts);
  t.ok(session.HyperDB.Files);
});

test.onFinish(async () => {
  // Clean up session
  await hyperSession.close();
  await sdk.close();
  process.exit(0)
});