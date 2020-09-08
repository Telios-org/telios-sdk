const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Account, HyperSession } = require('..');
const conf = require('./conf');

const storage = {
  Hyperdrive: null,
  Hypercore: null,
}

const hyperSession = new HyperSession();

test('Account - Make Keypairs', async t => {
  t.plan(4);
  const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

  t.ok(secretBoxKeypair.privateKey, `Secret box private key: ${secretBoxKeypair.privateKey}`);
  t.ok(secretBoxKeypair.publicKey, `Secret box public key: ${secretBoxKeypair.publicKey}`);

  t.ok(signingKeypair.privateKey, `Signing private key: ${signingKeypair.privateKey}`);
  t.ok(signingKeypair.publicKey, `Signing public key: ${signingKeypair.publicKey}`);
});

test('Account - Init', async t => {
  t.plan(4);

  try {
    const { Hypercore, Hyperdrive } = await hyperSession.add('Alice Session', {
      storage: __dirname + '/storage',
      Hypercore: {
        name: 'Alice',
        opts: {
          persist: false
        }
      },
      Hyperdrive: {
        name: 'Alice',
        opts: {
          persist: false
        }
      }
    });

    storage.Hypercore = Hypercore;
    storage.Hyperdrive = Hyperdrive;

    const opts = {
      account: {
        spkey: conf.ALICE_SIG_PUB_KEY,
        sbpkey: conf.ALICE_SB_PUB_KEY,
        recovery_email: conf.ALICE_RECOVERY
      },
      Hypercore,
      Hyperdrive
    };

    const { account, sig } = await Account.init(opts, conf.ALICE_SIG_PRIV_KEY);

    t.ok(account, 'Account object returned');
    t.ok(sig, 'Account object signed');
    t.ok(Hyperdrive.drive.key.toString('hex'), `Hyperdrive created ${Hyperdrive.drive.key.toString('hex')}`);
    t.ok(Hypercore.feed.key.toString('hex'), `Hypercore created ${Hypercore.feed.key.toString('hex')}`);
  } catch (err) {
    t.error(err);
  }
});

test('Account - Register', async t => {
  t.plan(1)
  const account = new Account({
    provider: 'telios.io'
  });
  const payload = {
    account: {
      spkey: conf.ALICE_SIG_PUB_KEY,
      sbpkey: conf.ALICE_SB_PUB_KEY,
      recovery_email: conf.ALICE_RECOVERY,
      device_id: conf.ALICE_DEVICE_1_ID,
      device_drive: conf.ALICE_DEVICE_1_DRIVE,
      device_core: conf.ALICE_DEVICE_1_CORE
    },
    sig: conf.ALICE_ACCOUNT_SIG
  }

  const res = await account.register(payload);
  
  t.ok(res, 'Account can register');
});

test('Account - Sign authorization payload', async t => {
  t.plan(1);

  const account = {
    spkey: conf.ALICE_SIG_PUB_KEY,
    sbpkey: conf.ALICE_SB_PUB_KEY,
    device_id: conf.ALICE_DEVICE_1_ID,
    sig: conf.ALICE_ACCOUNT_SERVER_SIG
  };
  
  const payload = Account.accountSignAuth(account, conf.ALICE_SIG_PRIV_KEY);
  
  console.log(payload);
  
  t.ok(payload, 'Account has authorization payload');
});

test('Account - Login', async t => {
  t.plan(1)
  const account = new Account({
    provider: 'telios.io'
  });
  const payload = {
    account: {
        spkey: 'bf04b8d6ebf36a46ae9d55a6d123b7c538e42fe21ac1beeddc5fae3c5ae313bd',
        sbpkey: 'b5e0818615181328fb9e65685ba1029644c8902726495a4d852282d36265087c',
        device_id: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
        sig: '4b0963a63a0f3aa22e798db7811043503a13a1088ad75759c22ec254353ae36751a191ec4d50c70a661a7d1d382644ff5bd883e203643b1ae42fd26ebf58a501'
      },
    sig: '6ae3469c4fda19ae381351f550b891b474ca4118f1901e433d76b3ebdd9566647c2bd54ac59c183affc56ae1e45f9689fddb80d1bafe820a4a8f48612cd81105'
  }

  const res = await account.login(payload);
  
  console.log(res);
  
  t.ok(res._access_token, 'Account can login');
});

test('Account - Logout', async t => {
  t.plan(2);
  const account = new Account({
    provider: 'telios.io'
  });

  const payload = { devices: 'all' };
  let token = null;

  t.rejects(account.logout(token, payload), null, 'Account login should return error when missing token');

  token = { value: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTI4MTYyMSwiaWF0IjoxNTk1Mjc4MDIxfQ.BOxQJ5FRVMKKAFAmHHpMJQVlpB-eGEmEWZLBcMtLuH4hsLmJSE3pKxvMz2OqDh75ECLofFHdNh4a1UojfjtxhfQKkSu-hxQkadQxjDhhrfTW_nGsTpBEX94n-HgjRpndzIJfvE_zz4DgqRN901PhIkKo1FFqkJxUkZHUU5afGAr5sAT3M6_RmoCpG7DNl2uLPOH4ZYae-fPMYeje0oiPmJyboxWQ7aolx5dhBWSMpYB4H7hudaueUYi6gkPZz2keAP9RzTGQFaQNRVtoFbFTsfz4XP9WnibqXTfmMBUF1E6RI5u2B43s2mG-wgGg9Ev9UkonGKRyzHEX5a_fCp4dEQ' };
  res = await account.logout(token, payload);
  
  t.ok(res, 'Account can logout of all devices');
});

test.onFinish(async () => {
  // Clean up session
  await storage.Hyperdrive.drive.destroyStorage();
  await storage.Hypercore.feed.destroyStorage();
  await hyperSession.close();

  process.exit(0)
});