const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Crypto = require('../util/crypto');
const { HyperSession } = require('..');

const hyperSession = new HyperSession();

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
    bootstrap: []
  });

  t.equals(session.status, 'open');
});

test('HyperSession - Add Core/Drive to Session', async t => {
  t.plan(2);
  
  try {
    let session = hyperSession.getActive();
    const driveOpts = {
      announce: true,
      seed: false,
      driveOpts: {
        persist: false
      }
    };

    await hyperSession.addDrive('Drive 1', driveOpts);

    const coreOpts = {
      announce: true,
      seed: false,
      coreOpts: {
        persist: false
      }
    };

    const feed = await hyperSession.addCore('Core 1', coreOpts);
    
    await feed.append('hello world');

    session = hyperSession.getActive();

    t.ok(session.CoreMap['Drive 1'], 'Active session added Drive 1');
    t.ok(session.CoreMap['Core 1'], 'Active session added Core 1');
  } catch (err) {
    t.error(err);
  }
});

test('HyperSession - Destroy Storage', async t => {
  t.plan(2);
  try {
    let CoreMap = await hyperSession.destroyStorage({ name: 'Drive 1', type: 'hyperdrive' });
    t.notOk(CoreMap['Drive 1'], 'Drive 1 successfully destroyed');
    CoreMap = await hyperSession.destroyStorage({ name: 'Core 1', type: 'hypercore' });
    t.notOk(CoreMap['Core 1'], 'Core 1 successfully destroyed');
  } catch (err) {
    t.error(err);
  }
});

test('HyperSession - Close Session', async t => {
  t.plan(1);
  const sessions = await hyperSession.close();
  t.equals(sessions[0].status, 'closed');
});

test('HyperSession - Resume Session', async t => {
  t.plan(8);

  const session = await hyperSession.resume('Alice Session');

  t.equals(session.status, 'open');
  t.ok(session.sdk);
  t.ok(session.HyperDB.Cores);
  t.ok(session.HyperDB.Drives);
  t.ok(session.HyperDB.Email);
  t.ok(session.HyperDB.Contacts);
  t.ok(session.HyperDB.Files);
  t.ok(session.CoreMap);
});

test.onFinish(async () => {
  // Clean up session
  await hyperSession.close();
  process.exit(0);
});