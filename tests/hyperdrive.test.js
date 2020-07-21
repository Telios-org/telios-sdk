const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hyperdrive } = require('..');

test('Hyperdrive - create drive', async t => {
  t.plan(1);

  try {
    const hyperdrive = new Hyperdrive('Account - Test Drive', { persist: false });
    const drive = await hyperdrive.createDrive();
    const key = drive.key.toString('hex');
    drive.close();
    t.ok(key, 'Generated Hyperdrive key');
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(() => process.exit(0));