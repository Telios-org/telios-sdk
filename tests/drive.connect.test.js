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

// Connect existing local drive
test('Connect Local Drive', async t => {
  t.plan(9);

  drive1 = new Drive(__dirname + '/drive', null, {
    keyPair,
    live: true,
    watch: true,
    seed: true
  });

  await drive1.ready();

  const owner = await drive1.db.get('owner');
  const publicKey = await drive1.db.get('__publicKey');
  const textFile = await drive1.db.get('test.txt');
  const textFileHash = await drive1.db.get(textFile.value.hash);
  const email = await drive1.db.get('email.eml');
  const emailHash = await drive1.db.get(email.value.hash);
  const docFile = await drive1.db.get('doc.txt');
  const docFileHash = await drive1.db.get(docFile.value.hash);

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  t.ok(publicKey.value.key, `Drive has publicKey: ${publicKey.value.key}`);
  t.ok(drive1.diffFeedKey, `Drive has diffFeedKey: ${drive1.diffFeedKey}`);
  t.ok(textFile.value.hash, `File test.txt has hash: ${textFile.value.hash}`);
  t.ok(textFileHash.value.size, `File test.txt has size: ${textFileHash.value.size}`);
  t.ok(email.value.hash, `File email.eml has hash: ${email.value.hash}`);
  t.ok(emailHash.value.size, `File email.eml has size: ${emailHash.value.size}`);
  t.ok(docFile.value.hash, `File doc.txt has hash: ${docFile.value.hash}`);
  t.ok(docFileHash.value.size, `File doc.txt has size: ${docFileHash.value.size}`);

  eventEmitter.on('add-peer', async (peer) => {
    await drive1.addPeer(peer);
    console.log('Added Peer')
  })
});

test('Create Cloned Drive', async t => {
  t.plan(12);
  const currentDir = path.join(__dirname, '/drive_cloned');
  const { secretBoxKeypair: keypair2 } = Account.makeKeys();
  drive2 = new Drive(currentDir, drivePubKey, {
    keyPair: keypair2,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  let fileCount = 0;

  await drive2.ready();
  
  //add drive1 as a peer to start replication
  await drive2.addPeer({ 
    diffKey: peerDiffKey, 
    access: ['write'] 
  });
  
  eventEmitter.emit('add-peer', { diffKey: drive2.diffFeedKey });

  eventEmitter.on('add-peer', async (peer) => {
    if(peer.diffKey !== drive2.diffFeedKey) {
      await drive2.addPeer(peer);
    }
  })

  drive2.on('add', async (data) => {
    fileCount+=1;

    if(fileCount === 3) {
      process.nextTick(async () => {
        const owner = await drive2.db.get('owner');
        const publicKey = await drive2.db.get('__publicKey');
        const textFile = await drive2.db.get('test.txt');
        const textFileHash = await drive2.db.get(textFile.value.hash);
        const email = await drive2.db.get('email.eml');
        const emailHash = await drive2.db.get(email.value.hash);
        const docFile = await drive2.db.get('doc.txt');
        const docFileHash = await drive2.db.get(docFile.value.hash);

        t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
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
      });
    }
  });

});

test('Create 3rd Cloned Drive', async t => {
  t.plan(12);
  const currentDir = path.join(__dirname, '/drive_clone3');
  const { secretBoxKeypair: keypair3 } = Account.makeKeys();

  drive3 = new Drive(currentDir, drivePubKey, {
    keyPair: keypair3,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });
  
  let fileCount = 0;

  await drive3.ready();

  await drive3.addPeer({ 
    diffKey: peerDiffKey, 
    access: ['write'] 
  });

  await drive3.addPeer({ 
    diffKey: drive2.diffFeedKey, 
    access: []
  });
  

  eventEmitter.emit('add-peer', { diffKey: drive3.diffFeedKey });

  drive3.on('add', async (data) => {
    fileCount+=1;

    if(fileCount === 3) {
      process.nextTick(async () => {
        const owner = await drive3.db.get('owner');
        const publicKey = await drive3.db.get('__publicKey');
        const textFile = await drive3.db.get('test.txt');
        const textFileHash = await drive3.db.get(textFile.value.hash);
        const email = await drive3.db.get('email.eml');
        const emailHash = await drive3.db.get(email.value.hash);
        const docFile = await drive3.db.get('doc.txt');
        const docFileHash = await drive3.db.get(docFile.value.hash);

        t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
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
  await drive1.close();
  await drive2.close();
  await drive3.close();
  process.exit(0);
});