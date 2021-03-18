const fs = require('fs');
const path = require('path');
const { Drive, Account } = require('../../');
const del = require('del');

module.exports.init = async () => {
  await cleanup();
  //await initDrives();

  return await initVars();
}

module.exports.conf = () => {
  const filePath = path.join(__dirname, '../vars.tmp.json');

  if(fs.existsSync(filePath)) {
    const testVars = fs.readFileSync(filePath);
    return JSON.parse(testVars);
  }

  return {};
}

async function cleanup() {
  if(fs.existsSync(path.join(__dirname, '../vars.tmp.json'))) {
    await del([
      path.join(__dirname, '../vars.tmp.json')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../data/encrypted.mail'))) {
    await del([
      path.join(__dirname, '../data/encrypted.mail')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../data/email.eml'))) {
    await del([
      path.join(__dirname, '../data/email.eml')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../data/enc_meta.tmp.json'))) {
    await del([
      path.join(__dirname, '../data/enc_meta.tmp.json')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../localDrive'))) {
    await del([
      path.join(__dirname, '../localDrive')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../drive1'))) {
    await del([
      path.join(__dirname, '../drive1')
    ]);
  }

  if(fs.existsSync(path.join(__dirname, '../drive2'))) {
    await del([
      path.join(__dirname, '../drive2')
    ]);
  }
}

async function initVars() {
  const tmpFilePath = path.join(__dirname, '../vars.tmp.json');
  const templatePath = path.join(__dirname, '../vars.json');
  let testVars = null;

  if(fs.existsSync(tmpFilePath)) {
    testVars = JSON.parse(fs.readFileSync(tmpFilePath));
  } else {
    testVars = JSON.parse(fs.readFileSync(templatePath));
    fs.writeFileSync(tmpFilePath, JSON.stringify(testVars));
  }

  // Mock server key bundle
  const serverKeys = Account.makeKeys();

  // Create Alice key bundle
  const aliceKeys = Account.makeKeys();
  testVars.ALICE_SB_PUB_KEY = aliceKeys.secretBoxKeypair.publicKey;
  testVars.ALICE_SB_PRIV_KEY = aliceKeys.secretBoxKeypair.privateKey;
  testVars.ALICE_SIG_PUB_KEY = aliceKeys.signingKeypair.publicKey;
  testVars.ALICE_SIG_PRIV_KEY = aliceKeys.signingKeypair.privateKey;
  testVars.ALICE_PEER_PUB_KEY = aliceKeys.peerKeypair.publicKey;
  testVars.ALICE_PEER_SECRET_KEY = aliceKeys.peerKeypair.secretKey;
  testVars.ALICE_DRIVE_KEY = '00000000000000000000000000000000';
  testVars.ALICE_DIFF_KEY= '11111111111111111111111111111111';
  testVars.ALICE_DEVICE_1_ID = '00000000-0000-0000-0000-000000000000';

  const opts = {
    account: {
      account_key: testVars.ALICE_SB_PUB_KEY,
      peer_key: testVars.ALICE_PEER_PUB_KEY,
      recovery_email: testVars.ALICE_RECOVERY,
      device_signing_key: testVars.ALICE_SIG_PUB_KEY,
      device_drive_key: testVars.ALICE_DRIVE_KEY,
      device_diff_key: testVars.ALICE_DIFF_KEY,
      device_id: testVars.ALICE_DEVICE_1_ID
    }
  };

  const { account, sig } = await Account.init(opts, testVars.ALICE_SIG_PRIV_KEY);

  testVars.ALICE_ACCOUNT_SIG = sig;
  testVars.ALICE_DEVICE_1_ID = account.device_id;
  testVars.ALICE_ACCOUNT_SERVER_SIG = '1010101100110101010101001101010';
  
  // Create Bob key bundle
  const bobKeys = Account.makeKeys();
  testVars.BOB_SB_PUB_KEY = bobKeys.secretBoxKeypair.publicKey;
  testVars.BOB_SB_PRIV_KEY = bobKeys.secretBoxKeypair.privateKey;
  testVars.BOB_SIG_PUB_KEY = aliceKeys.signingKeypair.publicKey;
  testVars.BOB_SIG_PRIV_KEY = aliceKeys.signingKeypair.privateKey;

  fs.writeFileSync(tmpFilePath, JSON.stringify(testVars));
  return testVars;
}

async function initDrives() {
  const { secretBoxKeypair: keyPair } = Account.makeKeys();
  const { secretBoxKeypair: keyPair2 } = Account.makeKeys();
  //const { secretBoxKeypair: keyPair3 } = Account.makeKeys();

  const drive1 = new Drive(path.join(__dirname, '../drive1'), null, {
    keyPair,
    writable: true
  });

  await drive1.ready();
  //console.log('Drive1 PubKey ', drive1.keyPair.publicKey);

  const drive2 = new Drive(path.join(__dirname, '../drive2'), drive1.publicKey, {
    keyPair: keyPair2,
    writable: true,
  });

  

  await drive2.ready();
  //console.log('Drive2 PubKey ', drive2.keyPair.publicKey);

  await drive2.addPeer(drive1.diffFeedKey, ['write']);
  await drive1.addPeer(drive2.diffFeedKey);
  
  fs.writeFileSync(path.join(__dirname, '../drive1/doc.txt'), 'test document');
  fs.writeFileSync(path.join(__dirname, '../drive1/email.email'), 'test email');
  fs.writeFileSync(path.join(__dirname, '../drive1/test.txt'), 'test text');
}