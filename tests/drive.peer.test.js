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
  keyPair2,
  keyPair3,
  drivePubKey,
  peerDiffKey
} = JSON.parse(tmp);

/**
 * Scenario: 
 * 1. Drive1 is initially created and is replicated by Drive2. 
 * 2. Drive2 does not have write access.
 * 3. Drive1 makes an update which gets replicated over to Drive2 and then goes offline.
 */

(async () => {
  const drive1Path = path.join(__dirname, '/drive');
  const drive2Path = path.join(__dirname, '/drive_cloned');
  const drive3Path = path.join(__dirname, '/drive_clone3');

  // const { secretBoxKeypair: keyPair2 } = Account.makeKeys();
  // const { secretBoxKeypair: keyPair3 } = Account.makeKeys();

  const drive1 = new Drive(drive1Path, null, {
    keyPair,
    live: true,
    watch: true,
    seed: true
  });

  const drive2 = new Drive(drive2Path, drivePubKey, {
    keyPair: keyPair2,
    live: true,
    watch: true,
    seed: true,
    slave: true
  });

  // const drive3 = new Drive(drive3Path, drivePubKey, {
  //   keyPair: keyPair3,
  //   live: true,
  //   watch: false,
  //   seed: true
  // });

  await drive1.ready();
  await drive2.ready();

  // Connect existing local drive
  test('Drive - Drive 1 Reconnects', async t => {
    t.plan(8);

    const publicKey = await drive1.db.get('__publicKey');
    const textFile = await drive1.db.get('test.txt');
    const textFileHash = await drive1.db.get(textFile.value.hash);
    const email = await drive1.db.get('email.eml');
    const emailHash = await drive1.db.get(email.value.hash);
    const docFile = await drive1.db.get('doc.txt');
    const docFileHash = await drive1.db.get(docFile.value.hash);
    console.log('Public Key : ', keyPair.publicKey);
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
    });
  });

  test('Drive - Drive2 Replicates and Seeds Drive 1', async t => {
    t.plan(13);
    const currentDir = path.join(__dirname, '/drive_cloned');
    console.log('Public Key : ', drive2.keyPair.publicKey);
    
    let fileCount = 0;
    
    //add drive1 as a peer to start replication
    await drive2.addPeer({ 
      diffKey: peerDiffKey, 
      access: ['write'] 
    });
    
    eventEmitter.emit('add-peer', { diffKey: drive2.diffFeedKey });

    // eventEmitter.on('add-peer', async (peer) => {
    //   if(peer.diffKey !== drive2.diffFeedKey) {
    //     await drive2.addPeer(peer);
    //   }
    // })

    drive2.on('file-add', async (data) => {
      fileCount+=1;

      if(fileCount === 3) {
        process.nextTick(async () => {
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

          fs.writeFileSync(`${drive1Path}/doc.txt`, 'test document updated!', 'utf-8');
          t.ok(1);
        });
      }
    });

    drive2.on('file-update', (filePath) => {
      console.log(filePath);
      eventEmitter.emit('close-drive');
      t.ok(filePath);
    });
  });

  test.onFinish(() => {
    drive1.close();
    drive2.close();
    process.exit(0);
  });
})();