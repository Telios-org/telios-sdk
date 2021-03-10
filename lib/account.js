const routes = require('./routes');
const Crypto = require('./crypto');
const callout = require('./callout');
const { v4: uuidv4 } = require('uuid');
const p2plex = require('p2plex');

class Account {
  constructor(provider, keyPair, opts) {
    super(opts);
    
    this.provider = provider;
    this.keyPair = keyPair;
    
    if(keyPair) {
      this._joinSelfSwarm();
    }
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
        secretKey: keyPair.secretKey.toString('hex'),
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
    
    return Buffer.from(auth, 'utf-8').toString('base64');
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

  _joinSelfSwarm() {
    const plex = p2plex({ keyPair: this.keyPair });
  
    plex.join(Buffer.from(this.keyPair.publicKey, 'hex'), { announce: true, lookup: false });

    plex.on('connection', (peer) => {
      peer.receiveStream('new-mail').on('data', (data) => {
        const { msg } = JSON.parse(data.toString('utf8'));
        this.emit('mail-received', { peerPubKey: peer.publicKey.toString('hex'), msg });
      })
    })
  }
}

module.exports = Account;