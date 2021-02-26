const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const { Drive, Account, Crypto } = require('..');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

const tmp = fs.readFileSync(__dirname + '/.tmp');
const {
  keypair,
  publicTopic,
  secretTopic,
  ownerDiffKey
} = JSON.parse(tmp);

// Connect existing local drive
test('Connect Local Drive', async t => {
  const drivePath = __dirname + '/drive';
  const metaPath = __dirname + '/meta/local/drive.meta';

  const drive = new Drive({
    keypair,
    metaPath,
    drivePath,
    live: true,
    watch: true
  });

  await drive.ready();
  
  drive.handShake({ announce: true, lookup: true });

  const owner = await drive.db.get('owner');
  const ownerMeta = await drive.db.get(owner.value.key);
  const file = await drive.db.get('test.txt');
  const hash = await drive.db.get(file.value.hash);

  //const decodedSecretTopic = Crypto.decryptSBMessage(ownerMeta.value.topic, keypair.publicKey, keypair.privateKey); 

  t.ok(owner.value.key, `Drive has owner with key: ${owner.value.key}`);
  //t.equals(drive.secretTopic, decodedSecretTopic, `Can decipher secret topic`);
  t.ok(drive.publicTopic, `Drive has Public Topic: ${drive.publicTopic}`);
  t.ok(drive.secretTopic, `Drive has Secret Topic: ${drive.secretTopic}`);
  t.ok(drive.diffFeed, `Drive has diffFeed: ${drive.diffFeed}`);
  t.ok(file.value.hash, `File test.txt was virtualized with hash: ${file.value.hash}`);
  t.ok(hash.value.size, `File test.txt has size: ${hash.value.size}`);

  eventEmitter.on('add-peer', async (peer) => {
    await drive.db.addPeer(peer);
  })

  eventEmitter.on('destroy', async (peer) => {
    drive.plex.destroy();
  })
});

// create a seeded drive
test('Create Seeded Drive', async t => {
  t.plan(2);
  const entries = {
    owner: false,
    file: false
  }

  const { secretBoxKeypair: keypair2 } = Account.makeKeys();
  
  const drivePath = __dirname + '/drive_cloned';
  const metaPath = __dirname + '/meta/remote/drive.meta';

  const drive = new Drive({
    keypair2,
    metaPath,
    drivePath,
    network: {
      publicTopic,
      secretTopic,
      peers: [ownerDiffKey] // Peer DiffFeed key
    },
    live: true,
    watch: true
  });

  await drive.ready();

  eventEmitter.emit('add-peer', drive.diffFeed);
  
  drive.handShake({ announce: true, lookup: false });

  // const rs = drive.db.createHistoryStream({ live: true, gte: -1 });

  // rs.on('data', async (data) => {
  //   onUpdate(data);
  // });

  // function onUpdate(data) {
  //   if (data.key === 'owner' && !entries.owner) {
  //     entries.owner = true;
  //     drive.handShake({ announce: true, lookup: true });
  //     t.ok(data.value, 'Seeded owner entry');
  //   }

  //   if (data.key === 'test.txt' && !entries.file) {
  //     entries.file = true;
  //     t.ok(data.value, 'Seeded test.txt entry');
  //   }
  // }

  setTimeout(() => {
    drive.close();
    t.end()
  }, 10000);
});

// peer handshake

// get file(s)

test.onFinish(async () => {
  // Clean up session
  fs.rmdirSync(__dirname + '/meta/local/', { recursive: true });
  fs.rmdirSync(__dirname + '/meta/remote/', { recursive: true });

  process.exit(0);
});