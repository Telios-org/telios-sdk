const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const conf = require('./conf');
const { HyperSession } = require('..');

const hyperSession = new HyperSession();

test('HyperSession - Add a New Session', async t => {
  t.plan(1);

  const session = await hyperSession.add('Alice Session', {
    storage: __dirname + '/storage/alice',
    Hypercore: {
      name: conf.MAILSERVER_CORE,
      opts: {
        persist: false
      }
    },
    Hyperdrive: {
      name: conf.MAILSERVER_DRIVE,
      opts: {
        persist: false
      }
    }
  });

  t.equals(session.status, 'open');
});

test('HyperSession - Close Session', async t => {
  t.plan(1);
  const sessions = await hyperSession.close();
  t.equals(sessions[0].status, 'closed');
});

test('HyperSession - Resume Session', async t => {
  t.plan(3);

  const session = await hyperSession.resume('Alice Session');

  t.equals(session.status, 'open');
  t.equals(session.Hypercore.feed.writable, true);
  t.equals(session.Hyperdrive.drive.opened, true);
});

test.onFinish(async () => {
  // Clean up session
  await session.Hyperdrive.drive.destroyStorage();
  await session.Hypercore.feed.destroyStorage();
  await hyperSession.close();

  process.exit(0)
});