const tape = require('tape');
const { Hyperdrive } = require('..');

tape('Hyperdrive - create drive', async t => {
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

tape.onFinish(() => process.exit(0));