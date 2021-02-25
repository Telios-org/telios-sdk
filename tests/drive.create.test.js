const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const { Drive, Account, Crypto } = require('..');

fs.mkdirSync(__dirname + '/meta/local');
fs.mkdirSync(__dirname + '/meta/remote');

test('Create Drive', async t => {
  t.plan(9);
  const drivePath = __dirname + '/drive';
  const metaPath = __dirname + '/meta/local/drive.meta';

  const { secretBoxKeypair: keypair1 } = Account.makeKeys();
  const { secretBoxKeypair: keypair2 } = Account.makeKeys();

  const peers = [
    {
      key: keypair2.publicKey
    }
  ];

  const drive = new Drive({
    keypair: keypair1,
    metaPath,
    drivePath,
    peers,
    live: true,
    watch: true,
    createNew: true
  });

  await drive.ready();

  drive.on('add', (data) => {
    t.ok(data, `${data}`);
  });

  const owner = await drive.db.get('owner');
  const ownerMeta = await drive.db.get(owner.value.key);
  const file = await drive.db.get('test.txt');
  const hash = await drive.db.get(file.value.hash);

  //const decodedSecretTopic = Crypto.decryptSBMessage(ownerMeta.value.topic, keypair1.publicKey, keypair1.privateKey);

  fs.writeFileSync(__dirname + '/.tmp', JSON.stringify({
    keypair: keypair1,
    publicTopic: drive.publicTopic,
    secretTopic: drive.secretTopic,
    ownerDiffKey: drive.diffFeed
  }));

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  //t.equals(drive.secretTopic, decodedSecretTopic, `Can decipher secret topic`);
  t.ok(drive.publicTopic, `Drive has Public Topic: ${drive.publicTopic}`);
  t.ok(drive.secretTopic, `Drive has Secret Topic: ${drive.secretTopic}`);
  t.ok(drive.diffFeed, `Drive has diffFeed: ${drive.diffFeed}`);
  t.ok(file.value.hash, `File test.txt was virtualized with hash: ${file.value.hash}`);
  t.ok(hash.value.size, `File test.txt has size: ${hash.value.size}`);
});

test.onFinish(async () => {
  // Clean up session
  process.exit(0);
});