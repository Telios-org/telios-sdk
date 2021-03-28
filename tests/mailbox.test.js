const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const { Mailbox, Drive, Account, Crypto } = require('..');
const MemoryStream = require('memorystream');

const testSetup = require('./helpers/setup');
const pump = require('pump');

let encMeta = null;
let sealedMsg = null;

const metaFilePath = path.join(__dirname, './data/enc_meta.tmp.json')

const conf = testSetup.conf();

(async () => {
  const localDrive = new Drive(path.join(__dirname, '/localDrive'), null, {
    keyPair: {
      publicKey: conf.ALICE_SB_PUB_KEY,
      privateKey: conf.ALICE_SB_PRIV_KEY
    }
  });

  await localDrive.ready();

  // Mailbox test setup
  const initMailbox = async () => {
    

    const mailbox =  new Mailbox({
      provider: 'https://apiv1.telios.io',
      auth: {
        claims: {
          account_key: conf.ALICE_SB_PUB_KEY,
          device_signing_key: conf.ALICE_SIG_PUB_KEY,
          device_peer_key: conf.ALICE_PEER_PUB_KEY,
          device_id: conf.ALICE_DEVICE_1_ID
        },
        device_signing_priv_key: conf.ALICE_SIG_PRIV_KEY,
        sig: conf.ALICE_ACCOUNT_SERVER_SIG
      }
    });

    return mailbox;
  }

  test('Mailbox - Send mail', async t => {
    t.plan(1);
    
    const mailbox = await initMailbox();
    const email = conf.TEST_EMAIL;

    const res = await mailbox.send(email, {
      privKey: conf.BOB_SB_PRIV_KEY,
      pubKey: conf.BOB_SB_PUB_KEY,
      drive: localDrive,
      dest: '/test-email.json'
    });

    t.ok(res, `Sent mail to Telios recipient`);
  });

  test('Mailbox - Encrypt mail metadata', async t => {
    t.plan(1);

    const mailbox = await initMailbox();
    const privKey = conf.BOB_SB_PRIV_KEY;
    const accountKey = conf.ALICE_SB_PUB_KEY;


    const meta = {
      "key": "test-key",
      "header": "test-header",
      "drive_key": localDrive.publicKey,
      "hash": 'test-hash',
      "name": 'test-email.json',
      "size": 100
    };

    encMeta = mailbox._encryptMeta(meta, accountKey, privKey);

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
      account_key: 'account-key-test',
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

    const rs = fs.createReadStream(path.join(__dirname, '/data/raw.email'));

    // Encrypt file and save on drive
    let { key, header, file } = await localDrive.writeFile('/email/rawEmailEncrypted.eml', { readStream: rs , encrypted: true });

    const meta = {
      "key": key,
      "header": header,
      "drive": localDrive.publicKey,
      "hash": file.hash
    };

    const encryptedMeta = mailbox._encryptMeta(meta, conf.ALICE_SB_PUB_KEY, conf.BOB_SB_PRIV_KEY);
    const encMsg = mailbox._sealMeta(encryptedMeta, conf.BOB_SB_PUB_KEY, conf.ALICE_SB_PUB_KEY);

    const encMeta = [{
      account_key: conf.ALICE_SB_PUB_KEY,
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
        account_key: 'account-key-test1',
        msg: 'encrypted message'
      },
      {
        account_key: 'account-key-test2',
        msg: 'encrypted message'
      }
    ];

    const res = await mailbox._sendMailMeta(payload);
    
    t.ok(res, `Sent mail metadata`);
  });

  test('Mailbox - Retrieve unread mail and decrypt', async t => {
    t.plan(3);

    const mailbox = await initMailbox();
    const mailMeta = await mailbox.getNewMail(conf.ALICE_SB_PRIV_KEY, conf.ALICE_SB_PUB_KEY);
    const { peerKeypair } = Account.makeKeys();
    const files = [];
    const drive2 = new Drive(__dirname + '/drive2', null, { keyPair: peerKeypair });
    
    await drive2.ready();

    for(meta of mailMeta) {
      files.push({
        hash: meta.hash
      });
    }

    drive2.download(localDrive.discoveryKey, files, { keyPair: peerKeypair });

    drive2.on('file-download', async (err, file) => {
      for(meta of mailMeta) {
        if(file.hash === meta.hash) {
          t.ok(file.path, `File has path ${file.path}`);
          t.ok(file.hash, `File has hash ${file.hash}`);

          if(file.encrypted) {
            const stream = await drive2.readFile(file.path, { key: meta.key, header: meta.header });

            let decrypted = '';

            stream.on('data', chunk => {
              decrypted += chunk.toString('utf-8');
            });

            stream.on('end', () => {
              t.ok(decrypted.length);
            })
          } else {
            t.ok(file, `${JSON.stringify(file)}`);
          }
      }
    }
    });
  });

  // test('Mailbox - Send mail directly to online recipient', async t => {
  //   const Alice = new Account('https://apiv1.telios.io', {
  //     publicKey: conf.ALICE_PEER_PUB_KEY,
  //     secretKey: conf.ALICE_PEER_SECRET_KEY
  //   });

  //   const Bob = new Account('https://apiv1.telios.io', {
  //     publicKey: conf.BOB_PEER_PUB_KEY,
  //     secretKey: conf.BOB_PEER_SECRET_KEY
  //   });
  // });

  test.onFinish(async () => {
    fs.unlinkSync(metaFilePath);
    await localDrive.close();
    process.exit(0);
  });
})();