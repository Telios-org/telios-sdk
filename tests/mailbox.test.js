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

test('Mailbox - Register alias', async t => {
  t.plan(1);
  const mailbox = await initMailbox();

  const res = await mailbox.registerAlias('alice-netflix@telios.io');

  t.equals(res.status, 200, 'Can create new alias');
});

test('Mailbox - Remove alias', async t => {
  t.plan(1);
  const mailbox = await initMailbox();

  const res = await mailbox.removeAlias('alice-netflix@telios.io');

  t.equals(res.status, 200, 'Can remove alias');
});

test('Mailbox - Get public keys', async t => {
  t.plan(3);
  const mailbox = await initMailbox();

  const res = await mailbox.getMailboxPubKeys(['alice@telios.io', 'tester@telios.io']);

  t.equals(res.url, `/mailbox/addresses/alice@telios.io,tester@telios.io`, `URL properly formed ${res.url}`);
  t.equals(res.status, 200, `Got mailbox public keys`);
  t.equals(2, res.data.length, 'Returned 2 mailbox public keys');
});

test('Mailbox - Get new mail metadata', async t => {
  t.plan(2);
  const mailbox = await initMailbox();
  const res = await mailbox._getNewMailMeta();
  t.equals(res.status, 200, `Retrieved new meta`);
  t.equals(1, res.data.length, `Mail meta count === ${res.data.length}`);
});

test('Mailbox - Retrieve unread mail and decrypt', async t => {
  t.plan(3);
  const mailbox = await initMailbox();
  const sbpkey = conf.ALICE_SB_PUB_KEY;
  const privKey = conf.ALICE_SB_PRIV_KEY;

  const mail = await mailbox.getNewMail(privKey, sbpkey);

  t.equals(1, mail.length, '1 Email was retrieved and deciphered');
  t.ok(mail[0]._id, 'Email has an _id');
  t.ok(mail[0].email, 'Email has a message object');
});

test('Mailbox - Mark emails as read', async t => {
  t.plan(1);
  const mailbox = await initMailbox();

  const res = await mailbox.markAsRead(['5f11e4554e19c8223640f0bc']);
  t.equals(res.status, 200, `Marked emails as read`);
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
  t.equals(res.status, 200, `Sent mail metadata`);
});

test('Mailbox - Send mail', async t => {
  t.plan(1);
  const mailbox = await initMailbox();
  const privKey = conf.BOB_SB_PRIV_KEY;
  const pubKey = conf.BOB_SB_PUB_KEY;
  const email = conf.TEST_EMAIL;

  const res = await mailbox.send(email, {
    privKey: privKey,
    pubKey: pubKey,
    drive: conf.MAILSERVER_DRIVE,
    drivePath: conf.MAILSERVER_DRIVE_PATH
  });

  t.equals(res.status, 200, `Sent mail to two Telios recipients`);
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