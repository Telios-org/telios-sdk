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

// const drive3 = new Drive(drive3Path, drivePubKey, {
//   keyPair: keyPair3,
//   live: true,
//   watch: false,
//   seed: true,
//   slave: true
// });

(async () => {
  await drive1.ready();
  await drive2.ready();


  test('Drive - Download File', async t => {
    t.plan(1);
    const file = await drive1.db.get('email.eml');
    const sourceFile = fs.readFileSync(path.join(__dirname, '/drive/email.eml'), 'utf-8');
    const stream = await Drive.download(drive1.discoveryKey, file.value.hash, { keyPair: keyPair3 });
    let fileData = '';

    stream.on('data', chunk => {
      fileData += chunk.toString('utf-8');
    });

    stream.on('end', () => {
      t.equals(fileData, sourceFile, 'Local file matches remote');
    });
  });

  test.onFinish(async () => {
    await drive1.close();
    await drive2.close();
    
    // del([
    //   __dirname + '/drive_cloned',
    //   __dirname + '/meta',
    //   __dirname + '/.tmp',
    //   __dirname + '/drive/.drive'
    // ]);

    process.exit(0);
  });
})();