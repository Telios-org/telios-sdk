const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const conf = require('./conf');
const { Mailbox, Hyperdrive } = require('..');
const SDK = require('dat-sdk');

let sdk = null;
let encMeta = null;
let driveKey = null;
let sealedMsg = null;

const metaFilePath = path.join(__dirname, 'data/meta/encrypted_meta_test.json');

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

  // await drive.download('/');
  let meta = [];

  meta.push(
    {
      sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
      msg: sealedMsg,
      _id: '5f1210b7a29fe6222f199f80'
    }
  )
  await fs.writeFileSync(metaFilePath, JSON.stringify(meta));
  await drive.close();
  
  t.end();
});

test('Mailbox - Register', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const payload = {
    sbpkey: '4bd1f102176d62a2f9b4598900e35b23e6a136da53590ba96c3e823f8c1d9c7c',
    name: 'Alice Tester',
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

test('Mailbox - Get new mail metadata', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  const res = await mailbox._getNewMailMeta();
  
  t.equals(1, res.length, `Mail meta count === ${res.length}`);
});

test('Mailbox - Send mail metadata', async t => {
  t.plan(1);
  
  const mailbox = await initMailbox();
  
  const payload = [
    {
      sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
      msg: 'f4e802a9cec3827079a59889abfa6fcbf49d9067809738969ba0060754e7bf33f8571689f9f79be3878a5474f210c2bf47db6378527e782ab8ac5389e9fd49a5dc8e14976dab97668becd036383b7c51fd90790a6c308aa2147a10682cd33afcc1b7cf300c8b0d96120997c59466e56fe4505e72aa1bfcb4d50c28a1d6ac23972e23668bb0897666906009970f24953ea5a2be09e9bbe94e7a434ddb9b26d17b437717ec2bffa0167cac07f40a63527c81eaa39eecca23bc327e8db03645dd82462bb46dc230c54b17bf484dd79ac29f09'
    },
    {
      sbpkey: '4c709ee7e6d43f1e01d9208c600d466d0c9382e27097ac84249a02b031bad24a',
      msg: 'b7b0d35992020a5b6b0bf83fe11afd917f7b038e2e74293f840843cc17fcc92ace56280b883a20028723f061cc4831c055842c279dcf30680acdcf7192c9d414f81ab19a6eac4cadbfb09830c0e7f2db599ec57f51be026e0fbc504b948ea68a1ab37d5c1bd06760e42297596fd5d3961736d74468a03d6f7f47bb7865d1ff45127b6e92db5a2d2d49788855489805b78cdfad421bd82984f00a432547cd58ab34ebff836ae9fbe28f3a32772ee0d8961059866ebcd538ad6e0336e52552d04d288e8bdd3a6957074746fbed23695d7bb3'
    }
  ];

  const res = await mailbox._sendMailMeta(payload);
  
  t.ok(res, `Sent mail metadata`);
});

test('Mailbox - Retrieve unread mail and decrypt', async t => {
  t.plan(3);
  const mailbox = await initMailbox();
  const mail = await mailbox.getNewMail(conf.ALICE_SB_PRIV_KEY, conf.ALICE_SB_PUB_KEY);

  t.equals(1, mail.length, '2 Emails were retrieved and deciphered');
  t.ok(mail[0]._id, 'Email has an _id');
  t.ok(mail[0].email, 'Email has a message object');
});

test.onFinish(async () => {
  // Clean up session
  await storage.Hyperdrive.drive.destroyStorage();
  await sdk.close();
  fs.unlinkSync(metaFilePath);
  process.exit(0);
});