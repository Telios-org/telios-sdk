const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Account } = require('..');

test('Account - Make Keypairs', async t => {
  t.plan(4);
  const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

  t.ok(secretBoxKeypair.privateKey, `Secret box private key: ${secretBoxKeypair.privateKey}`);
  t.ok(secretBoxKeypair.publicKey, `Secret box public key: ${secretBoxKeypair.publicKey}`);

  t.ok(signingKeypair.privateKey, `Signing private key: ${signingKeypair.privateKey}`);
  t.ok(signingKeypair.publicKey, `Signing public key: ${signingKeypair.publicKey}`);
});

test('Account - Init', async t => {
  t.plan(1);

  const { secretBoxKeypair, signingKeypair } = Account.makeKeys();
  
  try {
    const payload = await Account.init({
      spkey: signingKeypair.publicKey,
      sbpkey: secretBoxKeypair.publicKey,
      recovery_email: 'test@telios.io'
    });
    console.log(payload);
    t.ok(payload, 'Account payload signed');
  } catch (err) {
    t.error(err);
  }
});

test('Account - Sign authorization payload', async t => {
  t.plan(1)
  const account = {
    spkey: 'ef984b756a51e67ad49f653c90e826468bc931cd3ccf50aebec2fa1d549d864d',
    sbpkey: '4bd1f102176d62a2f9b4598900e35b23e6a136da53590ba96c3e823f8c1d9c7c',
    device_id: 'b1926811-860a-423c-ba13-b905d9dc5998',
    sig: 'abf20e4d0487427e4078df4459f16d9aed18e417e592a950badbe1d1e4038dc629c3b2de62062ea2c687046b2e0a207ff5c3630e07695a8892f0de5d12b46600'
  };
  
  const payload = Account.accountSignAuth(account);
  console.log(payload);
  t.ok(payload, 'Account has authorization payload');
});

test('Account - Register', async t => {
  t.plan(1)
  const account = new Account({
    provider: 'telios.io'
  });
  const payload = {
    account: {
      spkey: 'bf04b8d6ebf36a46ae9d55a6d123b7c538e42fe21ac1beeddc5fae3c5ae313bd',
      sbpkey: 'b5e0818615181328fb9e65685ba1029644c8902726495a4d852282d36265087c',
      recovery_email: 'test@telios.io',
      device_id: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
      device_drive: '7a3a58faecd67a5e0387525c31524aab94f22e4c0d0153c8ea1b79f9a10815bd',
      device_core: 'c20ebbfc5702bd4aabf86e055463c011bdcfd24785039c7d70d2be5e6016c7b5'
    },
    sig: '6ae3469c4fda19ae381351f550b891b474ca4118f1901e433d76b3ebdd9566647c2bd54ac59c183affc56ae1e45f9689fddb80d1bafe820a4a8f48612cd81105'
  }

  const res = await account.register(payload);
  t.equals(res.status, 200, 'Account can register');
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
  t.equals(res.status, 200, 'Account can login');
});

test('Account - Logout', async t => {
  const account = new Account({
    provider: 'telios.io'
  });
  const payload = { devices: 'all' };

  let token = null;
  t.rejects(account.logout(token, payload), null, 'Account login should return error when missing token');

  token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTI4MTYyMSwiaWF0IjoxNTk1Mjc4MDIxfQ.BOxQJ5FRVMKKAFAmHHpMJQVlpB-eGEmEWZLBcMtLuH4hsLmJSE3pKxvMz2OqDh75ECLofFHdNh4a1UojfjtxhfQKkSu-hxQkadQxjDhhrfTW_nGsTpBEX94n-HgjRpndzIJfvE_zz4DgqRN901PhIkKo1FFqkJxUkZHUU5afGAr5sAT3M6_RmoCpG7DNl2uLPOH4ZYae-fPMYeje0oiPmJyboxWQ7aolx5dhBWSMpYB4H7hudaueUYi6gkPZz2keAP9RzTGQFaQNRVtoFbFTsfz4XP9WnibqXTfmMBUF1E6RI5u2B43s2mG-wgGg9Ev9UkonGKRyzHEX5a_fCp4dEQ';
  res = await account.logout(token, payload);
  t.equals(res.status, 200, 'Account can logout of all devices');
  t.end();
});

test.onFinish(() => process.exit(0));