const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Account } = require('..');
const testSetup = require('./helpers/setup');
const p2plex = require('p2plex');

test('Test Setup', async t => {
  t.plan(1);
  await testSetup.init();
  t.ok(1);
});

test('Account - Make Keypairs', async t => {
  t.plan(6);
  const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys();

  t.ok(secretBoxKeypair.privateKey, `Secret box private key: ${secretBoxKeypair.privateKey}`);
  t.ok(secretBoxKeypair.publicKey, `Secret box public key: ${secretBoxKeypair.publicKey}`);

  t.ok(signingKeypair.privateKey, `Signing private key: ${signingKeypair.privateKey}`);
  t.ok(signingKeypair.publicKey, `Signing public key: ${signingKeypair.publicKey}`);

  t.ok(peerKeypair.secretKey, `Peer secret key: ${peerKeypair.secretKey}`);
  t.ok(peerKeypair.publicKey, `Peer public key: ${peerKeypair.publicKey}`);
});

test('Account - Init', async t => {
  t.plan(2);

  const conf = testSetup.conf();
  try {
    const opts = {
      account: {
        device_signing_key: conf.ALICE_SIG_PUB_KEY,
        account_key: conf.ALICE_SB_PUB_KEY,
        peer_key: conf.ALICE_PEER_PUB_KEY,
        recovery_email: conf.ALICE_RECOVERY,
        device_id: conf.ALICE_DEVICE_1_ID
      }
    };

    const { account, sig } = await Account.init(opts, conf.ALICE_SIG_PRIV_KEY);

    console.log({ account, sig: sig });

    t.ok(account, 'Account object returned');
    t.ok(sig, 'Account object signed');
  } catch (err) {
    t.error(err);
  }
});

test('Account - Register', async t => {
  t.plan(1)

  const conf = testSetup.conf();
  const account = new Account('https://apiv1.telios.io');
  const payload = {
    account: {
      device_signing_key: conf.ALICE_SIG_PUB_KEY,
      account_key: conf.ALICE_SB_PUB_KEY,
      peer_key: conf.ALICE_PEER_PUB_KEY,
      recovery_email: conf.ALICE_RECOVERY,
      device_id: conf.ALICE_DEVICE_1_ID,
    },
    sig: conf.ALICE_ACCOUNT_SIG,
    vcode: '11111'
  }
  
  const res = await account.register(payload, );
  
  t.ok(res, 'Account can register');
});

test('Account - Create auth token', async t => {
  t.plan(1);

  const conf = testSetup.conf();
  const claims = {
    device_signing_key: conf.ALICE_SIG_PUB_KEY,
    account_key: conf.ALICE_SB_PUB_KEY,
    peer_key: conf.ALICE_PEER_PUB_KEY,
    device_id: conf.ALICE_DEVICE_1_ID,
    sig: conf.ALICE_ACCOUNT_SERVER_SIG
  };
  
  const payload = Account.createAuthToken(claims, conf.ALICE_SIG_PRIV_KEY);
  console.log(payload);
  t.ok(payload, 'Account has authorization payload');
});

test('Account - Join Swarm', async t => {
  t.plan(2);

  const conf = testSetup.conf();
  const account = new Account('https://apiv1.telios.io', {
    publicKey: conf.ALICE_PEER_PUB_KEY,
    secretKey: conf.ALICE_PEER_SECRET_KEY
  });

  account.on('mail-received', data => {
    t.ok(data.peerPubKey, `Peer public key: ${data.peerPubKey}`);
    t.ok(data.msg, `Mail message: ${data.msg}`);
  });

  const plex = p2plex();

  plex.join(Buffer.from(conf.ALICE_PEER_PUB_KEY, 'hex'), { announce: false, lookup: true });

  plex.on('connection', (peer) => {
    peer.createStream('new-mail').end(JSON.stringify({ msg: "encrypted meta message" }))
  })
});

test.onFinish(async () => {
  process.exit(0);
});