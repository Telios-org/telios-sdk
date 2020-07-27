const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');

const conf = require('./conf');
const { Mailbox, Hyperdrive } = require('..');
const Crypto = require('../util/crypto');

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
  // const { npub, encrypted } = Crypto.encryptAED(key, email);

  // console.log('KEY :: ', key.toString('hex'));
  // console.log('NPUB :: ', npub.toString('hex'));
  // console.log('MESSAGE :: ', encrypted);

  

  // fs.writeFileSync(__dirname + '/encrypted.mail', encrypted);

  // // return encrypted metadata
  // const meta = {
  //   "key": key.toString('hex'),
  //   "pub": npub.toString('hex'),
  //   "drive": conf.MAILSERVER_DRIVE,
  //   "path": conf.MAILSERVER_DRIVE_PATH
  // };

  // const encryptedMeta = Mailbox._encryptMeta(meta, sbpkey, privKey);

  // console.log('Encrypted metadata :: ', encryptedMeta);

  // const sealedMsg = {
  //   "from": conf.BOB_SB_PUB_KEY,
  //   "meta": encryptedMeta
  // }

  // const encMsg = Crypto.encryptSealedBox(JSON.stringify(sealedMsg), sbpkey);

  // console.log('Final Message :: ', encMsg.toString('hex'));
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

  t.equals(res.status, 200, 'Mailbox can create new mailbox');
});

test('Mailbox - Get public keys', async t => {
  t.plan(4);
  const mailbox = await initMailbox();

  const res = await mailbox.getMailboxPubKeys(['alice@telios.io', 'tester@telios.io']);

  t.equals(res.url, `/mailbox/addresses/alice@telios.io,tester@telios.io`, `URL properly formed ${res.url}`);
  t.equals(res.status, 200, `Got mailbox public keys`);
  t.ok(res.data['alice@telios.io'], `Returned Alice\'s Public Key ${res.data['alice@telios.io']}`);
  t.ok(res.data['tester@telios.io'], `Returned Tester\'s Public Key ${res.data['tester@telios.io']}`);
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
  const sbpkey = conf.ALICE_SB_PUB_KEY;
  const privKey = conf.ALICE_SB_PRIV_KEY;

  const mail = await mailbox.getNewMail(privKey, sbpkey);

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
    sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
    msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
  };

  const res = await mailbox.sendMailMeta(payload);
  t.equals(res.status, 200, `Sent mail metadata`);
});

test('Mailbox - Send mail', async t => {
  //t.plan(1);
  const mailbox = await initMailbox();
  const privKey = conf.BOB_SB_PRIV_KEY;
  const email = conf.TEST_EMAIL;

  const res = await mailbox.send(email, {
    privKey: privKey,
    drive: conf.MAILSERVER_DRIVE,
    drivePath: conf.MAILSERVER_DRIVE_PATH
  });
  t.end();
});

test('Mailbox - Encrypt mail metadata', async t => {
  const mailbox = await initMailbox();

  t.plan(1);
  const privKey = '04968601b00541a9a2188b1709b4c11534ad419fd4d8143a67b3622bf924e5ee';
  const sbpkey = '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725';
  
  const meta = {
    "key": "fbe4ead33e63ef791435f0d1aae5b7a534f31e6c5d3245ea771170e272ede084",
    "header": "5b6dedb36d173385f35323f07d83d76019845784361cd0a9",
    "drive": "asdf133asdfe2tgrgfeer131dv1cfasfaefadf2323rewczcaef",
    "path": conf.MAILSERVER_DRIVE_PATH
  };

  const encoded = mailbox._encryptMeta(meta, sbpkey, privKey);


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