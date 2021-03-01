const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const { Drive, Account, Crypto } = require('..');

fs.mkdirSync(__dirname + '/meta');
fs.mkdirSync(__dirname + '/meta/local');
fs.mkdirSync(__dirname + '/meta/remote');

test('Create Drive', async t => {
  t.plan(7);
  const { secretBoxKeypair: keypair1 } = Account.makeKeys();
  const { secretBoxKeypair: keypair2 } = Account.makeKeys();

  const drive = new Drive(__dirname + '/drive', null, {
    keyPair: keypair1,
    live: true,
    watch: true
  });

  await drive.ready();

  drive.on('add', (data) => {
    t.ok(data, `${data}`);
  });

  const owner = await drive.db.get('owner');
  const file = await drive.db.get('test.txt');
  const hash = await drive.db.get(file.value.hash);

  fs.writeFileSync(__dirname + '/.tmp', JSON.stringify({
    keyPair: keypair1,
    drivePubKey: drive.publicKey,
    peerDiffKey: drive.diffFeedKey
  }));

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  t.ok(drive.diffFeedKey, `Drive has diffFeedKey: ${drive.diffFeedKey}`);
  t.ok(file.value.hash, `File test.txt was virtualized with hash: ${file.value.hash}`);
  t.ok(hash.value.size, `File test.txt has size: ${hash.value.size}`);
});

test.onFinish(async () => {
  // Clean up session
  process.exit(0);
});