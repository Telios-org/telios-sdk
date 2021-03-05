const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const { Drive, Account, Crypto } = require('..');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
const del = require('del');

const tmp = fs.readFileSync(__dirname + '/.tmp');
const {
  keyPair,
  drivePubKey
} = JSON.parse(tmp);

const drive1Path = path.join(__dirname, '/drive');
const drive2Path = path.join(__dirname, '/drive_cloned');
const drive3Path = path.join(__dirname, '/drive_clone3');

const { secretBoxKeypair: keyPair2 } = Account.makeKeys();
const { secretBoxKeypair: keyPair3 } = Account.makeKeys();

const drive1 = new Drive(drive1Path, null, {
  keyPair,
  live: true,
  watch: true,
  seed: true
});

const drive2 = new Drive(drive2Path, drivePubKey, {
  keyPair: keyPair2,
  live: true,
  watch: false,
  seed: true,
  slave: true
});

const drive3 = new Drive(drive3Path, drivePubKey, {
  keyPair: keyPair3,
  live: true,
  watch: false,
  seed: true,
  slave: true
});

(async () => {
  await drive1.ready();
  await drive2.ready();
  await drive3.ready();


  test('Drive - Add New File', async t => {
    t.plan(2);

    fs.writeFileSync(`${drive1Path}/hello.txt`, 'Hello World!', 'utf-8');
    
    drive2.on('file-add', (filePath) => {
      t.ok(filePath, 'File added on Drive 2');
    });

    drive3.on('file-add', (filePath) => {
      t.ok(filePath, 'File added on Drive 3');
    });
  });

  test('Drive - Test Remove File', async t => {
    t.plan(2);

    del([
      path.join(drive1Path,'/hello.txt'),
    ]);

    drive2.on('file-unlink', (filePath) => {
      t.ok(filePath, `Deleted ${filePath}`);
    });

    drive3.on('file-unlink', (filePath) => {
      t.ok(filePath, `Deleted ${filePath}`);
    });

  });

  test('Drive - Test Rename File', async t => {
    t.end();
  });

  test('Drive - Get Stats', async t => {
    console.log(drive1.size());
    t.end();
  });

  test.onFinish(async () => {
    await drive1.close();
    await drive2.close();
    await drive3.close();

    del([
      __dirname + '/drive_cloned',
      __dirname + '/drive_clone3',
      __dirname + '/meta',
      __dirname + '/.tmp',
      __dirname + '/drive/.drive'
    ]);

    process.exit(0);
  });
})();