const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
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

test('Drive - Connect Seed', async t => {
  t.plan(11);
  const currentDir = path.join(__dirname, '/drive_cloned');
  const { secretBoxKeypair: keypair2 } = Account.makeKeys();
  drive2 = new Drive(currentDir, drivePubKey, {
    keyPair: keypair2,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  await drive2.ready();

  const publicKey = await drive2.db.get('__publicKey');
  const textFile = await drive2.db.get('test.txt');
  const textFileHash = await drive2.db.get(textFile.value.hash);
  const email = await drive2.db.get('email.eml');
  const emailHash = await drive2.db.get(email.value.hash);
  const docFile = await drive2.db.get('doc.txt');
  const docFileHash = await drive2.db.get(docFile.value.hash);

  t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
  t.ok(drive2.diffFeedKey, `Drive has diffFeedKey: ${drive2.diffFeedKey}`);
  t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
  t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
  t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
  t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
  t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
  t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);

  t.ok(fs.existsSync(currentDir + '/doc.txt'), 'File doct.txt exists');
  t.ok(fs.existsSync(currentDir + '/email.eml'), 'File email.eml exists');
  t.ok(fs.existsSync(currentDir + '/test.txt'), 'File test.txt exists');

  eventEmitter.on('add-peer', async (peer) => {
    //if(peer.diffKey !== drive2.diffFeedKey) {
      await drive2.addPeer(peer);
      console.log('Added Peer')
    //}
  })
});

test('Drive - Create Another Seed', async t => {
  t.plan(11);
  const currentDir = path.join(__dirname, '/drive_seed');
  const { secretBoxKeypair: keyPair } = Account.makeKeys();

  drive3 = new Drive(currentDir, drivePubKey, {
    keyPair,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  let fileCount = 0;

  await drive3.ready();

  await drive3.addPeer({ 
    diffKey: drive2.diffFeedKey, 
    access: ['write']
  });

  eventEmitter.emit('add-peer', { diffKey: drive3.diffFeedKey, access: ['write'] });

  t.ok(drive3.publicKey, `Drive has publicKey: ${drive3.publicKey}`);
  t.ok(drive3.diffFeedKey, `Drive has diffFeedKey: ${drive3.diffFeedKey}`);

  drive3.on('file-add', async (data) => {
    fileCount+=1;

    if(fileCount === 3) {
      process.nextTick(async () => {
        const publicKey = await drive3.db.get('__publicKey');
        const textFile = await drive3.db.get('test.txt');
        const textFileHash = await drive3.db.get(textFile.value.hash);
        const email = await drive3.db.get('email.eml');
        const emailHash = await drive3.db.get(email.value.hash);
        const docFile = await drive3.db.get('doc.txt');
        const docFileHash = await drive3.db.get(docFile.value.hash);

        t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
        t.ok(drive3.diffFeedKey, `Drive has diffFeedKey: ${drive3.diffFeedKey}`);
        t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
        t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
        t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
        t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
        t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
        t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);

        t.ok(fs.existsSync(currentDir + '/doc.txt'), 'File doct.txt exists');
        t.ok(fs.existsSync(currentDir + '/email.eml'), 'File email.eml exists');
        t.ok(fs.existsSync(currentDir + '/test.txt'), 'File test.txt exists');
      });
    }
  });
});

test.onFinish(async () => {
  process.exit(0);
});