const conf = require('./conf');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hyperdrive } = require('..');

test('Hyperdrive - create drive', async t => {
  t.plan(1);

  try {
    const opts = {
      name: 'Test Drive',
      storage: __dirname + '/drive',
      driveOpts: {
        persist: false
      }
    };

    const hyperdrive = new Hyperdrive(opts);
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

    const key = drive.key.toString('hex');
    drive.close();
    t.ok(key, 'Generated Hyperdrive key');
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(() => process.exit(0));