const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');

const conf = require('./conf');
const { Mailbox, Hyperdrive } = require('..');
const SDK = require('dat-sdk');

let sdk = null;
let encMeta = null;
let driveKey = null;
let sealedMsg = null;

const storage = {
  Hyperdrive: null
}


// Mailbox test setup
const initMailbox = async () => {
  const mailbox =  new Mailbox({
    provider: 'telios.io',
    token: {
      value: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTI4MTYyMSwiaWF0IjoxNTk1Mjc4MDIxfQ.BOxQJ5FRVMKKAFAmHHpMJQVlpB-eGEmEWZLBcMtLuH4hsLmJSE3pKxvMz2OqDh75ECLofFHdNh4a1UojfjtxhfQKkSu-hxQkadQxjDhhrfTW_nGsTpBEX94n-HgjRpndzIJfvE_zz4DgqRN901PhIkKo1FFqkJxUkZHUU5afGAr5sAT3M6_RmoCpG7DNl2uLPOH4ZYae-fPMYeje0oiPmJyboxWQ7aolx5dhBWSMpYB4H7hudaueUYi6gkPZz2keAP9RzTGQFaQNRVtoFbFTsfz4XP9WnibqXTfmMBUF1E6RI5u2B43s2mG-wgGg9Ev9UkonGKRyzHEX5a_fCp4dEQ'
    }
  });

  return mailbox;
}

test('Setup', async t => {
  sdk = await SDK({ storage: __dirname + '/storage' });

  const driveOpts = {
      name: conf.MAILSERVER_DRIVE,
      sdk: sdk,
      driveOpts: {
        persist: true
      }
    };
    
  const hyperdrive = new Hyperdrive(driveOpts);
  const drive = await hyperdrive.connect();
  driveKey = drive.key.toString('hex');

  if (!await hyperdrive.dirExists(conf.ALICE_MAILBOX)) {
    await drive.mkdir(conf.ALICE_MAILBOX);
  }

  // write encrypted mail to drive
  const email = fs.readFileSync(__dirname + '/data/encrypted.mail');
  await drive.writeFile(conf.MAILSERVER_DRIVE_PATH, email);

  // write encrypted stream to drive
  const email2 = fs.readFileSync(__dirname + '/data/encrypted_stream.email');

  await drive.writeFile(conf.MAILSERVER_DRIVE_PATH2, email2);

  storage.Hyperdrive = hyperdrive;

  t.end();
});

test('Mailbox - Encrypt raw email', async t => {
  const mailbox = await initMailbox();

  // create writestream
  const stream = await fs.createWriteStream(__dirname + '/data/encrypted_tmp.email');

  // Encrypt file and save on hyperdrive
  const { key, header } = await mailbox._encryptStream(__dirname + '/data/raw.email', stream);

  t.ok(key, `Key was created ${key}`);
  t.ok(header, `Header was created ${header}`);
  t.end();
});

test('Mailbox - Send mail', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const email = conf.TEST_EMAIL;

  const res = await mailbox.send(email, {
    privKey: conf.BOB_SB_PRIV_KEY,
    pubKey: conf.BOB_SB_PUB_KEY,
    drive: storage.Hyperdrive,
    drivePath: conf.MAILSERVER_DRIVE_PATH
  });

  t.ok(res, `Sent mail to Telios recipient`);
});

test('Mailbox - Encrypt mail metadata', async t => {
  t.plan(1);

  const mailbox = await initMailbox();
  const privKey = conf.BOB_SB_PRIV_KEY;
  const sbpkey = conf.ALICE_SB_PUB_KEY;


  const meta = {
    "key": "73a827b60b31da552877228d0a74135b492fb7e3e6616f423e033d1137971688",
    "header": "1b69f5d224f050b4b92879d359207e954584d594f9ba4e8c",
    "drive": `hyper://${driveKey}`,
    "path": conf.MAILSERVER_DRIVE_PATH2
  };

  encMeta = mailbox._encryptMeta(meta, sbpkey, privKey);

  t.ok(encMeta, `Encrypted mail metadata => ${encMeta}`);
});

test('Mailbox - Seal encrypted metadata', async t => {
  const mailbox = await initMailbox();

  const fromPubKey = conf.BOB_SB_PUB_KEY;
  const toPubKey = conf.ALICE_SB_PUB_KEY;

  sealedMsg = mailbox._sealMeta(encMeta, fromPubKey, toPubKey);

  t.ok(sealedMsg, 'Sealed encrypted metadata');
  t.end();
});

test('Mailbox - Send mailserver message', async t => {
  const opts = {
    name: 'META',
    sdk: sdk,
    driveOpts: {
      persist: true
    }
  };

  const hyperdrive = await new Hyperdrive(opts);
  const drive = await hyperdrive.connect();

  await drive.download('/');
  
  let meta = JSON.parse(await drive.readFile('/meta/encrypted_meta_test.json'));

  meta.push(
    {
      sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
      msg: sealedMsg,
      _id: '5f1210b7a29fe6222f199f80'
    }
  )
  await drive.writeFile('/meta/encrypted_meta_test.json', JSON.stringify(meta));
  await drive.close();
  
  t.end();
});

test('Mailbox - Register', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const payload = {
    sbpkey: '4bd1f102176d62a2f9b4598900e35b23e6a136da53590ba96c3e823f8c1d9c7c',
    addr: 'test@telios.io',
    pwd: 'password'
  };

  const res = await mailbox.registerMailbox(payload);

  t.equals(res.registered, true, 'Mailbox can create new mailbox');
});

test('Mailbox - Register alias', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const res = await mailbox.registerAlias('alice-netflix@telios.io');

  t.equals(res.registered, true, 'Can create new alias');
});

test('Mailbox - Remove alias', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const res = await mailbox.removeAlias('alice-netflix@telios.io');

  t.equals(res.removed, true, 'Can remove alias');
});

test('Mailbox - Get public keys', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const res = await mailbox.getMailboxPubKeys(['alice@telios.io']);

  t.equals(1, res.length, 'Returned 1 mailbox public key');
});

test('Mailbox - Mark emails as synced', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const res = await mailbox.markAsSynced(['5f11e4554e19c8223640f0bc']);
  
  t.ok(res, `Marked emails as synced`);
});

test.onFinish(async () => {
  // Clean up session
  await storage.Hyperdrive.drive.destroyStorage();
  await sdk.close();
  process.exit(0);
});