const routes = require('./routes');
const Client = require('./client');
const Crypto = require('./crypto');
const callout = require('./callout');
const { v4: uuidv4 } = require('uuid');
const p2plex = require('p2plex');

class Account extends Client {
  constructor(opts) {
    super(opts);
    this.initPeerListener();
  }

  static makeKeys() {
    const signingKeypair = Crypto.signSeedKeypair();
    const secretBoxKeypair = Crypto.boxSeedKeypair();

    const plex = p2plex();
    const { keyPair } = plex;

    return {
      signingKeypair: signingKeypair,
      secretBoxKeypair: secretBoxKeypair,
      peerKeypair: {
        privateKey: keyPair.secretKey.toString('hex'),
        publicKey: keyPair.publicKey.toString('hex')
      }
    }
  }

  // Account Actions
  static async init(opts, privKey) {
    // Generate device ID
    const id = uuidv4();

    // Create Account payload
    const acct = {
      ...opts.account,
      device_id: id
    };

    // Sign payload
    const sig = Crypto.signDetached(acct, privKey);

    return { account: acct, sig: sig };
  }

  static createAuthToken(account, privKey) {
    account['date_time'] = new Date().toISOString();

    const sig = Crypto.signDetached(account, privKey);
    const auth = JSON.stringify({ account: { ...account }, sig: sig });
    
    return new Buffer(auth).toString('base64');
  }

  register(payload) {
    // signature precheck
    try {
      if (!Crypto.verifySig(payload.sig, payload.account.device_signing_key, payload.account)) throw new Error('Unable to verify account signature');

      return callout({
        provider: this.provider,
        payload: payload,
        route: routes.account.register
      });
    } catch (e) {
      console.log(e);
    }
  }

  initPeerListener() {
    const plex = p2plex({ keyPair: this.opts.peerKeypair });

    plex.on('connection', (peer) => {
      peer.receiveStream('newMail').on('data', (data) => {
        if (peer.publicKey.toString('hex') === this.opts.providerPeerKey) {
          this.emit('newMail', { peerKey: peer.publicKey, data: data.toString('utf8') });
        }
      })
    })
  }
}

module.exports = Account;