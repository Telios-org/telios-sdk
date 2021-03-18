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

const drive1 = new Drive(drive1Path, null, { keyPair });

const drive2 = new Drive(drive2Path, drivePubKey, {
  keyPair: keyPair2,
  writable: false
});

// const drive3 = new Drive(drive3Path, drivePubKey, {
//   keyPair: keyPair3,
//   live: true,
//   writable: false,
//   seed: true,
//   slave: true
// });

(async () => {
  await drive1.ready();
  await drive2.ready();


  test('Drive - Download File', async t => {
    t.plan(4);
    const file = await drive1.db.get('email.eml');
    const dest = path.join(__dirname, '/data/email.eml');
    const sourceFile = fs.readFileSync(path.join(__dirname, '/drive/email.eml'), 'utf-8');

    const files = [
      {
        dest,
        hash: file.value.hash
      }
    ];

    const request = Drive.download(drive1.discoveryKey, files, { keyPair: keyPair3 });

    request.on('file-download', (file) => {
      t.ok(file.path, `File has path ${file.path}`);
      t.ok(file.hash, `File has hash ${file.hash}`);
      t.ok(file.source, `File has source ${file.source}`);
    });

    request.on('finished', () => {
      t.ok(fs.existsSync(dest), 'File downloaded and exists in set destination');
    });

  });

  test.onFinish(async () => {
    process.exit(0);
  });
})();