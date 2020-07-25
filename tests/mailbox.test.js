const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');

const conf = require('./conf');
const { Mailbox, Hyperdrive } = require('..');

// Mailbox test setup
const initMailbox = async () => {
  return new Mailbox({
    provider: 'telios.io',
    token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTI4MTYyMSwiaWF0IjoxNTk1Mjc4MDIxfQ.BOxQJ5FRVMKKAFAmHHpMJQVlpB-eGEmEWZLBcMtLuH4hsLmJSE3pKxvMz2OqDh75ECLofFHdNh4a1UojfjtxhfQKkSu-hxQkadQxjDhhrfTW_nGsTpBEX94n-HgjRpndzIJfvE_zz4DgqRN901PhIkKo1FFqkJxUkZHUU5afGAr5sAT3M6_RmoCpG7DNl2uLPOH4ZYae-fPMYeje0oiPmJyboxWQ7aolx5dhBWSMpYB4H7hudaueUYi6gkPZz2keAP9RzTGQFaQNRVtoFbFTsfz4XP9WnibqXTfmMBUF1E6RI5u2B43s2mG-wgGg9Ev9UkonGKRyzHEX5a_fCp4dEQ'
  });
}

test('Setup', async t => {
  const hyperdrive = new Hyperdrive(conf.MAILSERVER_DRIVE, { persist: true });
  await hyperdrive.connect();
  const drive = hyperdrive.drive;

  if (!await hyperdrive.dirExists(conf.ALICE_MAILBOX)) {
    await drive.mkdir(conf.ALICE_MAILBOX);
  }

  // write encrypted mail to drive
  const email = fs.readFileSync(__dirname + '/encrypted.mail');
  drive.writeFile(conf.MAILSERVER_DRIVE_PATH, email);

  // const privKey = conf.BOB_SB_PRIV_KEY;
  // const sbpkey = conf.ALICE_SB_PUB_KEY;

  // const email = JSON.stringify(conf.TEST_EMAIL);

  // const key = Crypto.generateAEDKey();
  // const { npub, msg } = Crypto.encryptAED(key, email);

  // console.log('KEY :: ', key.toString('hex'));
  // console.log('NPUB :: ', npub.toString('hex'));
  // console.log('MESSAGE :: ', msg);

  

  // fs.writeFileSync(__dirname + '/encrypted.mail', msg);

  // // return encrypted metadata
  // const meta = {
  //   "key": key.toString('hex'),
  //   "pub": npub.toString('hex'),
  //   "drive": conf.MAILSERVER_DRIVE,
  //   "path": conf.MAILSERVER_DRIVE_PATH
  // };

  // const encrypted_meta = Mailbox._encryptMeta(meta, sbpkey, privKey);

  // console.log('Encrypted metadata :: ', encrypted_meta);
  // t.end();
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

  t.equals(res.status, 200, 'Mailbox can create new mailbox');
});

test('Mailbox - Get Public Key', async t => {
  t.plan(2);
  const mailbox = await initMailbox();

  const res = await mailbox.getMailboxPubKey('test@telios.io');
  t.equals(res.url, `/mailbox/address/test@telios.io`, `URL properly formed ${res.url}`);
  t.equals(res.status, 200, `Got mailbox public key ${res.data.sbpkey}`);
});

test('Mailbox - Get new mail metadata', async t => {
  t.plan(2);
  const mailbox = await initMailbox();
  const res = await mailbox._getNewMailMeta();
  t.equals(res.status, 200, `Retrieved new meta`);
  t.equals(1, res.data.length, `Mail meta count === ${res.data.length}`);
});

test('Mailbox - Retrieve unread mail and decrypt', async t => {
  t.plan(1);
  const mailbox = await initMailbox();
  const privKey = conf.ALICE_SB_PRIV_KEY;
  const sbpkey = conf.BOB_SB_PUB_KEY;

  const mail = await mailbox.getNewMail(sbpkey, privKey);

  t.ok(mail, `Decrypted and retrieved new mail`);
  t.end();
});

test('Mailbox - Mark messages as read', async t => {
  t.plan(1);
  const mailbox = await initMailbox();
  
  const payload = {
    "msg_ids": ["5f11e4554e19c8223640f0bc"]
  };

  const res = await mailbox.markAsRead(payload);
  t.equals(res.status, 200, `Marked mail messages as read`);
});

test('Mailbox - Send mail metadata', async t => {
  t.plan(1);
  const mailbox = await initMailbox();
  
  const payload = {
    sbpkey: '207a09c53b2c3b9b95c95871a20d3485d3594345dffa8636a7be151ab3821428',
    msg: 'eafa21c9ab3d1d9c58db61139670c68ea0e550a52cf230e77d59bf6004323abeb0c5c2701ab73fe8b6a074b9f4fa5c0bf2cbaeee22605adea5fd72f6bb7c425c2a30a1f53873a22b10433ce27da1f26c6bf1f2be6b1854a4e36ff3bfa6a05ef06871bbf5054476c836a6006e126b2cf903514b074136f73634e7383912c734f5339bafb0ae5c39e26174a54b2903f33d9926430940bc72568d258a671613202c6927195736b4d4d61dff64601c00f12ca3bd88e247ebbc00a353d31a2d8a909450b7b3f8c8d763afe537cc3bcb7cac6d91b1185baf09361591960719bed4b92d64c000c9b0d2a44f4afc1a281bb6430379f6e3aa1354601815187581e762b35b164eff9b235cc3fa5a85f5fb0d3bdb24861adbab8139f98c9c7880d2289855c5a4'
  };

  const res = await mailbox.sendMailMeta(payload);
  t.equals(res.status, 200, `Sent mail metadata`);
});

test('Mailbox - Send mail', async t => {
  //t.plan(1);
  const mailbox = await initMailbox();
  
  const email = conf.TEST_EMAIL;

  const res = await mailbox.send(email);
  t.end();
});

test('Mailbox - Encrypt mail metadata', async t => {
  t.plan(1);
  const privKey = '04968601b00541a9a2188b1709b4c11534ad419fd4d8143a67b3622bf924e5ee';
  const sbpkey = '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725';
  
  const meta = {
    "key": "fbe4ead33e63ef791435f0d1aae5b7a534f31e6c5d3245ea771170e272ede084",
    "header": "5b6dedb36d173385f35323f07d83d76019845784361cd0a9",
    "drive": "asdf133asdfe2tgrgfeer131dv1cfasfaefadf2323rewczcaef",
    "path": conf.MAILSERVER_DRIVE_PATH
  };

  const encoded = Mailbox._encryptMeta(meta, sbpkey, privKey);


  t.ok(encoded, `Encrypted mail metadata => ${encoded}`);
});

test.onFinish(async () => {
  // Clean up drives
  const hyperdrive = new Hyperdrive(conf.MAILSERVER_DRIVE, { persist: true });
  await hyperdrive.connect();
  const drive = hyperdrive.drive;
  drive.destroyStorage();
  process.exit(0);
});