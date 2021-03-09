const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const { Drive, Account, Crypto } = require('..');
const del = require('del');

const { secretBoxKeypair: keyPair } = Account.makeKeys();
const { secretBoxKeypair: keyPair2 } = Account.makeKeys();
const { secretBoxKeypair: keyPair3 } = Account.makeKeys();

(async () => {
  if(fs.existsSync(path.join(__dirname, '/drive'))) {
    await del([
      __dirname + '/drive'
    ]);
  }

  fs.mkdirSync((path.join(__dirname, '/drive')))
  fs.writeFileSync(path.join(__dirname, '/drive/doc.txt'), 'test document');
  fs.writeFileSync(path.join(__dirname, '/drive/email.eml'), 'test email');
  fs.writeFileSync(path.join(__dirname, '/drive/test.txt'), 'test text');

  test('Drive - Create', async t => {
    t.plan(8);

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

    if(fs.existsSync(path.join(__dirname, '/drive/hello.txt'))) {
      await del([
        __dirname + '/drive/hello.txt'
      ]);
    }

    const drive = new Drive(__dirname + '/drive', null, {
      keyPair,
      live: true,
      watch: true
    });

    await drive.ready();

    const publicKey = await drive.db.get('__publicKey');
    const textFile = await drive.db.get('test.txt');
    const textFileHash = await drive.db.get(textFile.value.hash);
    const email = await drive.db.get('email.eml');
    const emailHash = await drive.db.get(email.value.hash);
    const docFile = await drive.db.get('doc.txt');
    const docFileHash = await drive.db.get(docFile.value.hash);

    fs.writeFileSync(__dirname + '/.tmp', JSON.stringify({
      keyPair,
      keyPair2,
      keyPair3,
      drivePubKey: drive.publicKey,
      peerDiffKey: drive.diffFeedKey
    }));

    t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
    t.ok(drive.diffFeedKey, `Drive has diffFeedKey: ${drive.diffFeedKey}`);
    t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
    t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
    t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
    t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
    t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
    t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);
  });

  // // Connect existing local drive
  // test('Drive - Connect Existing Local', async t => {
  //   t.plan(8);

  //   const drive = new Drive(__dirname + '/drive', null, {
  //     keyPair,
  //     live: true,
  //     watch: true,
  //     seed: true
  //   });

  //   await drive.ready();

  //   const publicKey = await drive.db.get('__publicKey');
  //   const textFile = await drive.db.get('test.txt');
  //   const textFileHash = await drive.db.get(textFile.value.hash);
  //   const email = await drive.db.get('email.eml');
  //   const emailHash = await drive.db.get(email.value.hash);
  //   const docFile = await drive.db.get('doc.txt');
  //   const docFileHash = await drive.db.get(docFile.value.hash);

  //   t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
  //   t.ok(drive.diffFeedKey, `Drive has diffFeedKey: ${drive.diffFeedKey}`);
  //   t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
  //   t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
  //   t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
  //   t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
  //   t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
  //   t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);

  //   await drive.close();
  // });

  test.onFinish(async () => {
    // Clean up session
    
    process.exit(0);
  });
})();