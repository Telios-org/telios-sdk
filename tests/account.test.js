const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Account, Hypercore } = require('..');
const conf = require('./conf');
const SDK = require('dat-sdk');

let acctCore = null;

test('Account - Test Setup', async t => {
  let sdk = await SDK({ storage: __dirname + '/storage' });

  let opts = {
    name: 'Alice',
    sdk: sdk,
    coreOpts: {
      persist: false
    }
  };

  acctCore = new Hypercore(opts);
  await acctCore.connect();
});

test('Account - Make Keypairs', async t => {
  t.plan(6);
  const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys();

  t.ok(secretBoxKeypair.privateKey, `Secret box private key: ${secretBoxKeypair.privateKey}`);
  t.ok(secretBoxKeypair.publicKey, `Secret box public key: ${secretBoxKeypair.publicKey}`);

  t.ok(signingKeypair.privateKey, `Signing private key: ${signingKeypair.privateKey}`);
  t.ok(signingKeypair.publicKey, `Signing public key: ${signingKeypair.publicKey}`);

  t.ok(peerKeypair.privateKey, `Peer secret key: ${peerKeypair.privateKey}`);
  t.ok(peerKeypair.publicKey, `Peer public key: ${peerKeypair.publicKey}`);
});

test('Account - Init', async t => {
  t.plan(2);

  try {
    const opts = {
      account: {
        device_signing_key: conf.ALICE_SIG_PUB_KEY,
        sbpkey: conf.ALICE_SB_PUB_KEY,
        peer_key: conf.ALICE_PEER_PUB_KEY,
        recovery_email: conf.ALICE_RECOVERY,
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
  const account = new Account({
    provider: 'https://apiv1.telios.io'
  });
  const payload = {
    account: {
      device_signing_key: conf.ALICE_SIG_PUB_KEY,
      sbpkey: conf.ALICE_SB_PUB_KEY,
      peer_key: conf.ALICE_PEER_PUB_KEY,
      recovery_email: conf.ALICE_RECOVERY,
      device_id: conf.ALICE_DEVICE_1_ID,
    },
    sig: conf.ALICE_ACCOUNT_SIG
  }
  
  const res = await account.register(payload);
  
  t.ok(res, 'Account can register');
});

test('Account - Create auth token', async t => {
  t.plan(1);

  const claims = {
    device_signing_key: conf.ALICE_SIG_PUB_KEY,
    sbpkey: conf.ALICE_SB_PUB_KEY,
    peer_key: conf.ALICE_PEER_PUB_KEY,
    device_id: conf.ALICE_DEVICE_1_ID,
    sig: conf.ALICE_ACCOUNT_SERVER_SIG
  };
  
  const payload = Account.createAuthToken(claims, conf.ALICE_SIG_PRIV_KEY);
  console.log(payload);
  t.ok(payload, 'Account has authorization payload');
});

test.onFinish(async () => {
  await storage.Hyperdrive.drive.destroyStorage();
  await storage.Hypercore.feed.destroyStorage();

  process.exit(0);
});