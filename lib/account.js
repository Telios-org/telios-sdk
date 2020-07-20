const Crypto = require('./crypto');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');
const { v4: uuidv4 } = require('uuid');

class Account {
  constructor(opts) {
    this.opts = opts;
  }

  static makeKeys() {
    const signingKeypair = Crypto.generateSigKeypair();
    const secretBoxKeypair = Crypto.generateSBKeypair();

    return {
      signingKeypair: signingKeypair,
      secretBoxKeypair: secretBoxKeypair
    }
  }

  // Account Actions
  static async init(params) {
    // Generate device ID
    const id = uuidv4();
    
    // Create Hypercore
    const hypercore = new Hypercore('Account - Test Core', { persist: true });
    const core = await hypercore.createCore();
    const coreKey = core.key.toString('hex');
    await core.close();
    
    // Create Hyperdrive
    const hyperdrive = new Hyperdrive('Account - Test Drive', { persist: true });
    const drive = await hyperdrive.createDrive();
    const driveKey = drive.key.toString('hex');
    await drive.close();
    // Create Account payload
    const acct = {
      ...params,
      device_id: id,
      device_drive: driveKey,
      device_core: coreKey
    };

    // Sign payload
    const sig = Crypto.signDetached(acct, acct.spkey);

    return { account: acct, sig: sig };
  }

  static accountAuthSign(account, sig) {
    return Crypto.signDetached(account, sig);
  }

  register(acct) {
    
  }

  authenticate() {

  }

  login() {

  }
}

module.exports = Account;