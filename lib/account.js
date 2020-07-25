const routes = require('../routes');
const Client = require('./client');
const Crypto = require('../util/crypto');
const Hyperdrive = require('./hyperdrive');
const Hypercore = require('./hypercore');
const callout = require('./callout');
const { v4: uuidv4 } = require('uuid');

class Account extends Client {
  constructor(opts) {
    super(opts);
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
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

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

  static accountSignAuth(account) {
    const sig = Crypto.signDetached(account, account.spkey);
    return { account: { ...account }, sig: sig };
  }

  register(payload) {
    return callout({
      provider: this.provider,
      payload: payload,
      route: routes.account.register
    });
  }

  login(payload) {
    return callout({
      provider: this.provider,
      payload: payload,
      route: routes.account.login
    });
  }

  logout(token, payload) {
    return callout({
      provider: this.provider,
      token: token,
      payload: payload,
      route: routes.account.logout
    });
  }
}

module.exports = Account;