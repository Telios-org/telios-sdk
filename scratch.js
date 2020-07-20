const telios = require('./test');

/**
 * GENERATE KEYS
 */
const sigKeypair = telios.generateSignatureKeypair();
const boxKeypair = telios.generateSecretBoxKeypair();



/**
 * CREATE ACCOUNT
 */
let account = {
  spkey: sigKeypair.publicKey,
  sbpkey: boxKeypair.publicKey,
  recovery_email: 'gareth@telios.io',
  device_id: 'dafdfafsfsf',
  device_drive: 'dafasdfsdafdsa',
  device_core: 'sfasdfasafsafadfsafsaff'
};

console.log('Account', account);
let sig = telios.accountSign(account);
console.log('Account Signature ==> ', sig);





/**
 * AUTHENTICATE WITH ACCOUNT
 */
account.sig = sig;
const serviceSig = '49bf97401c957e0c361bade75107b8082d7f2fa30d30e50d5781ea26bc3cf941d62d09b4ffecbe8437d7ca7beac3f0129a8fca795e7a3705ec58b671e2a67c09';
sig = telios.accountAuthSign(account, serviceSig);
console.log('Account authorization signature => ', sig);