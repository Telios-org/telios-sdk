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
    const signingKeypair = Crypto.signSeedKeypair();
    const secretBoxKeypair = Crypto.boxSeedKeypair();

    return {
      signingKeypair: signingKeypair,
      secretBoxKeypair: secretBoxKeypair
    }
  }

  // Account Actions
  static async init(opts, privKey) {
    // Generate device ID
    const id = uuidv4();
    
    // Create Hypercore
    const hypercore = new Hypercore(opts.core);
    const core = await hypercore.createCore();
    const coreKey = core.key.toString('hex');
    await core.close();
    
    // Create Hyperdrive
    const hyperdrive = new Hyperdrive(opts.drive);
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

    const driveKey = drive.key.toString('hex');
    await drive.close();

    // Create Account payload
    const acct = {
      ...opts.account,
      device_id: id,
      device_drive: driveKey,
      device_core: coreKey
    };

    // Sign payload
    const sig = Crypto.signDetached(acct, privKey);

    return { account: acct, sig: sig };
  }

  static accountSignAuth(account, privKey) {
    const sig = Crypto.signDetached(account, privKey);
    return { account: { ...account }, sig: sig };
  }

  register(payload) {
    // signature precheck
    if (!Crypto.verifySig(payload.sig, payload.account.spkey, payload.account)) throw new Error('Unable to verify account signature');

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