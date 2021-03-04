const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const { Drive, Account, Crypto } = require('..');
const del = require('del');


test('Create Drive', async t => {
  if(fs.existsSync(path.join(__dirname, '/drive_cloned'))) {
    await del([
      __dirname + '/drive_cloned'
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '/drive_clone3'))) {
    await del([
      __dirname + '/drive_clone3'
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '/meta'))) {
    await del([
      __dirname + '/meta'
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '/drive/.drive'))) {
    await del([
      __dirname + '/drive/.drive'
    ]);
  }

  fs.mkdirSync(__dirname + '/meta');
  fs.mkdirSync(__dirname + '/meta/local');
  fs.mkdirSync(__dirname + '/meta/remote');

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
  const publicKey = await drive.db.get('__publicKey');
  const textFile = await drive.db.get('test.txt');
  const textFileHash = await drive.db.get(textFile.value.hash);
  const email = await drive.db.get('email.eml');
  const emailHash = await drive.db.get(email.value.hash);
  const docFile = await drive.db.get('doc.txt');
  const docFileHash = await drive.db.get(docFile.value.hash);

  fs.writeFileSync(__dirname + '/.tmp', JSON.stringify({
    keyPair: keypair1,
    drivePubKey: drive.publicKey,
    peerDiffKey: drive.diffFeedKey
  }));

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
  t.ok(drive.diffFeedKey, `Drive has diffFeedKey: ${drive.diffFeedKey}`);
  t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
  t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
  t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
  t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
  t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
  t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);
});

test.onFinish(async () => {
  // Clean up session
  process.exit(0);
});