const conf = require('./conf');
const fs = require('fs');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hyperdrive } = require('..');
const SDK = require('dat-sdk');
let hyperdrive = null;

test('Hyperdrive - create drive', async t => {
  t.plan(1);

  try {
    const sdk = await SDK({
      storage: __dirname + '/storage'
    });

    const opts = {
      name: 'Test Delete Drive',
      sdk: sdk,
      driveOpts: {
        persist: false
      }
    };

    hyperdrive = new Hyperdrive(opts);
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

    const key = drive.key.toString('hex');

    t.ok(key, `Generated Hyperdrive key ${key}`);
  } catch (err) {
    t.error(err);
  }
});

test('Hyperdrive - remove file', async t => {
  t.plan(1);

  try {
    const readStream = fs.createReadStream(__dirname + '/data/raw.email');
    const writeStream = hyperdrive.drive.createWriteStream('emails/raw.email');
    
    readStream.pipe(writeStream);

    // TODO: Update this test to confirm data has been freed up
    hyperdrive.drive.on('update', async () => {
      try {
        await hyperdrive.removeFile('emails/raw.email');
        t.ok(true);
      } catch (err) {
        // no catch
      }
    });

  } catch (err) {
    t.error(err);
  }
});

test.onFinish(async () => {
  await hyperdrive.close();
  await hyperdrive.drive.destroyStorage();
  
  process.exit(0);
});