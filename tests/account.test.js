const config = require('../tests/config');
const tape = require('tape');
const { Account } = require('..');

tape('Account - Make Keypairs', async t => {
  t.plan(4);
  const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

  t.ok(secretBoxKeypair.privateKey, 'Secret box private key');
  t.ok(secretBoxKeypair.publicKey, 'Secret box public key');

  t.ok(signingKeypair.privateKey, 'Signing private key');
  t.ok(signingKeypair.publicKey, 'Signing public key');
});

tape('Account - Init', async t => {
  t.plan(1);

  const { secretBoxKeypair, signingKeypair } = Account.makeKeys();
  
  try {
    const payload = await Account.init({
      spkey: signingKeypair.publicKey,
      sbpkey: secretBoxKeypair.publicKey,
      recovery_email: 'test@telios.io'
    });
    t.ok(payload, 'Account payload signed');
  } catch (err) {
    t.error(err);
  }
});

tape.onFinish(() => process.exit(0));