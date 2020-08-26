const conf = require('./conf');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hyperdrive } = require('..');
const SDK = require('dat-sdk');

test('Hyperdrive - create drive', async t => {
  t.plan(1);

  try {
    const sdk = await SDK();

    const opts = {
      name: 'Test Drive',
      sdk: sdk,
      driveOpts: {
        persist: false
      }
    };

    const hyperdrive = new Hyperdrive(opts);
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

    const key = drive.key.toString('hex');

    await drive.destroyStorage();
    await hyperdrive.close();

    t.ok(key, `Generated Hyperdrive key ${key}`);
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(() => process.exit(0));