const tape = require('tape');
const { signSeedKeypair, boxSeedKeypair } = require('../util/crypto');

tape('Crypto', async t => {
  const signKeypair = signSeedKeypair();
  const boxKeypair = boxSeedKeypair();


  const restoredSignKeypair = signSeedKeypair(signKeypair.seedKey);
  const restoredBoxKeypair = boxSeedKeypair(boxKeypair.seedKey);

  t.equals(restoredSignKeypair.publicKey, signKeypair.publicKey, 'Signature deterministic public keys match');
  t.equals(restoredSignKeypair.privateKey, signKeypair.privateKey, 'Signature deterministic private keys match');
  t.equals(restoredBoxKeypair.publicKey, boxKeypair.publicKey, 'Secret Box deterministic public keys match');
  t.equals(restoredBoxKeypair.privateKey, boxKeypair.privateKey, 'Secret Box deterministic private keys match');
  t.end();
});