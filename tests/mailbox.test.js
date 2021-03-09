const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const { Mailbox, Drive, Account, Crypto } = require('..');
const MemoryStream = require('memorystream');

const testSetup = require('./helpers/setup');

let sdk = null;
let encMeta = null;
let driveKey = null;
let sealedMsg = null;

const metaFilePath = path.join(__dirname, './data/enc_meta.tmp.json')

const storage = {
  Hyperdrive: null
}

const conf = testSetup.conf();


(async () => {
  const localDrive = new Drive(path.join(__dirname, '/localDrive'), null, {
    keyPair: {
      publicKey: conf.ALICE_SB_PUB_KEY,
      privateKey: conf.ALICE_SB_PRIV_KEY
    },
    live: true,
    watch: true,
    seed: true
  });

  await localDrive.ready();

  // Mailbox test setup
  const initMailbox = async () => {
    

    const mailbox =  new Mailbox({
      provider: 'https://apiv1.telios.io',
      auth: {
        claims: {
          device_signing_key: conf.ALICE_SIG_PUB_KEY,
          sbpkey: conf.ALICE_SB_PUB_KEY,
          peer_key: conf.ALICE_PEER_PUB_KEY,
          device_id: conf.ALICE_DEVICE_1_ID
        },
        device_signing_priv_key: conf.ALICE_SIG_PRIV_KEY,
        sig: conf.ALICE_ACCOUNT_SERVER_SIG
      }
    });

    return mailbox;
  }

  test('Mailbox - Encrypt raw email', async t => {
    const mailbox = await initMailbox();

    // create writestream
    const ws = fs.createWriteStream(path.join(__dirname, '/localDrive/encrypted.email'));
    const rs = fs.createReadStream(path.join(__dirname, '/data/raw.email'));
    // Encrypt file and save on drive
    const { key, header } = await mailbox._encryptStream(rs, ws, { drive: localDrive });

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
      drive: localDrive,
      filePath: '/'
    });

    t.ok(res, `Sent mail to Telios recipient`);
  });

  test('Mailbox - Encrypt mail metadata', async t => {
    t.plan(1);

    const mailbox = await initMailbox();
    const privKey = conf.BOB_SB_PRIV_KEY;
    const sbpkey = conf.ALICE_SB_PUB_KEY;


    const meta = {
      "key": "test-key",
      "header": "test-header",
      "drive": localDrive.publicKey,
      "hash": 'test-hash'
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

  test('Mailbox - Register', async t => {
    t.plan(1);
    
    const mailbox = await initMailbox();
    const payload = {
      sbpkey: 'sbpkey-test',
      name: 'Alice Tester',
      addr: 'test@telios.io'
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
    const email = conf.TEST_EMAIL;

    const location = `/35bdbc1c-063f-4595-a001-05dd070b6123`;
    const writeStream = fs.createWriteStream(path.join(localDrive.drivePath, location));
    const stream = new MemoryStream();

    stream.end(JSON.stringify(email));

    const { file, key, header } = await mailbox._encryptStream(stream, writeStream, { drive: localDrive });
    const meta = {
      "key": key,
      "header": header,
      "drive": localDrive.publicKey,
      "hash": file.hash
    };

    const encryptedMeta = mailbox._encryptMeta(meta, conf.ALICE_SB_PUB_KEY, conf.BOB_SB_PRIV_KEY);
    const encMsg = mailbox._sealMeta(encryptedMeta, conf.BOB_SB_PUB_KEY, conf.ALICE_SB_PUB_KEY);

    const encMeta = [{
      sbpkey: conf.ALICE_SB_PUB_KEY,
      msg: encMsg.toString('hex'),
      _id: '5f1210b7a29fe6222f199f80'
    }];

    fs.writeFileSync(metaFilePath, JSON.stringify(encMeta));

    const res = await mailbox.getNewMailMeta();
    
    t.equals(1, res.length, `Mail meta count === ${res.length}`);
  });

  test('Mailbox - Send mail metadata', async t => {
    t.plan(1);
    
    const mailbox = await initMailbox();
    
    const payload = [
      {
        sbpkey: 'sbpkey-test1',
        msg: 'encrypted message'
      },
      {
        sbpkey: 'sbpkey-test2',
        msg: 'encrypted message'
      }
    ];

    const res = await mailbox._sendMailMeta(payload);
    
    t.ok(res, `Sent mail metadata`);
  });

  test('Mailbox - Retrieve unread mail and decrypt', async t => {
    t.plan(2);

    const mailbox = await initMailbox();
    const mailMeta = await mailbox.getNewMail(conf.ALICE_SB_PRIV_KEY, conf.ALICE_SB_PUB_KEY);
    const { peerKeypair } = Account.makeKeys();

    for(meta of mailMeta) {
      Drive.download(localDrive.discoveryKey, meta.hash, { keyPair: peerKeypair })
        .then(stream => {
          let toSkip = 24;
          const key = Buffer.from(meta.key, 'hex');
          let header = Buffer.from(meta.header, 'hex');
          let message = Buffer.from([]);
          let state = Crypto.initStreamPullState(header, key);
          let data = [];

          stream.on('data', function (chunk) {
            if (toSkip == 0) {
              message = Crypto.secretStreamPull(chunk, state);
            } else if (toSkip > chunk.length) {
              toSkip -= chunk.length;
            } else {
              if (toSkip !== chunk.length) {
                message = Crypto.secretStreamPull(chunk.slice(toSkip), state);
              }
              
              toSkip = 0;
            }
          });
        
          stream.on('end', async () => {
            const msg = message.toString('utf8');
            const email = JSON.parse(msg);

            t.ok(email.subject, 'Email has subject');
          });

          stream.on('error', async (err) => {
            console.log(err);
          });
        });
    }

    t.equals(1, mailMeta.length, '1 Email meta message was retrieved');
  });

  test.onFinish(async () => {
    // Clean up session
    // await storage.Hyperdrive.drive.destroyStorage();
    // await sdk.close();
    fs.unlinkSync(metaFilePath);
    await localDrive.close();
    process.exit(0);
  });
})();