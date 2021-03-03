const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const { Drive, Account, Crypto } = require('..');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

const tmp = fs.readFileSync(__dirname + '/.tmp');
const {
  keyPair,
  drivePubKey,
  peerDiffKey
} = JSON.parse(tmp);

let drive1, drive2, drive3;

// Connect existing local drive
test('Connect Local Drive', async t => {
  t.plan(6);

  drive1 = new Drive(__dirname + '/drive', null, {
    keyPair,
    live: true,
    watch: true,
    seed: true
  });

  await drive1.ready();

  const owner = await drive1.db.get('owner');
  const file = await drive1.db.get('test.txt');
  const hash = await drive1.db.get(file.value.hash);

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  t.ok(drive1.publicKey, `Drive has Public Key: ${drive1.discoveryKey}`);
  t.ok(drive1.discoveryKey, `Drive has Discovery Key: ${drive1.discoveryKey}`);
  t.ok(drive1.diffFeedKey, `Drive has diffFeedKey: ${drive1.diffFeedKey}`);
  t.ok(file.value.hash, `File test.txt was virtualized with hash: ${file.value.hash}`);
  t.ok(hash.value.size, `File test.txt has size: ${hash.value.size}`);
});

test('Create Cloned Drive', async t => {

  const { secretBoxKeypair: keypair2 } = Account.makeKeys();
  drive2 = new Drive(__dirname + '/drive_cloned', drivePubKey, {
    keyPair: keypair2,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  let fileCount = 0;

  await drive2.ready();

  drive2.on('add', (data) => {
    fileCount+=1;

    if(fileCount === 3) {
      t.ok(1);
    }
  });

});

test('Create another peer', async t => {
  const { secretBoxKeypair: keypair3 } = Account.makeKeys();
  drive3 = new Drive(__dirname + '/drive_clone3', drivePubKey, {
    keyPair: keypair3,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  let fileCount = 0;

  await drive3.ready();

  drive3.on('add', (data) => {
    fileCount+=1;

    if(fileCount === 3) {
      t.ok(1);
    }
  });

});

// test('Update and Sync New Files', async t => {
//   fs.writeFileSync(__dirname + '/drive/test123.txt', 'This is a new file!');
// });

// test('Update and Sync Existing Files', async t => {
//   fs.writeFileSync(__dirname + '/drive/test.txt', new Date())
// });

// test('Delete Files', async t => {
//   fs.unlinkSync(__dirname + '/drive/test123.txt');
// });

// test('Delete Files', async t => {
//   // await drive1.close();
//   // await drive2.close();
//   // await drive3.close();
// });

test.onFinish(async () => {
  process.exit(0);
});