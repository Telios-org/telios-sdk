const callout = require('./callout');
const routes = require('../routes');
const Client = require('./client');
const Hyperdrive = require('./hyperdrive');
const Crypto = require('../util/crypto');

class Mailbox extends Client {
  constructor(opts) {
    super(opts);
  }

  registerMailbox(payload) {    
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register
    });
  }

  createAlias() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register_alias
    });
  }

  removeAlias() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register_alias
    });
  }

  getMailboxPubKeys(addresses) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_public_key,
      param: addresses
    });
  }

  async getNewMail(privKey, sbpkey) {
    const newMail = await this._getNewMailMeta();
    const promises = [];

    for (let i = 0; i < newMail.data.length; i++) {
      promises.push(this._decryptMail(newMail.data[i].msg, privKey, sbpkey));
    }

    return Promise.all(promises);
  }

  _getNewMailMeta() {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_new_mail
    });
  }

  async _decryptMail(encMsg, privKey, sbpkey) {
    const msg = JSON.parse(Crypto.decryptSealedBox(encMsg, privKey, sbpkey));
    const meta = JSON.parse(Crypto.decryptSBMessage(msg.meta, msg.from, privKey));
    const hyperdrive = new Hyperdrive(meta.drive, { persist: false });
    await hyperdrive.connect();
    return hyperdrive.readEncryptedMail(meta);
  }

  /**
   * When sending an email to multiple recipients, the recipient's email domain is checked
   * for whether or not their inbox is telios.io or a provider that's using the same encryption
   * protocol. If so, the email is encrypted, stored on the local drive, and then an encrypted message
   * is posted for the recipient where they can retrieve their encrypted email.
   * 
   * In the instance of multiple recipients from non-compatible email providers, the email
   * is sent without encryption. The reason for this is it doesn't make sense to encrypt an email that's
   * being sent in cleartext to other recipients. If some of the recipients are using telios.io, the email will
   * be encrypted when picked up by the mailserver for those users.
   */
  async send(email, opts) {
    let extRecipients = false;
    const recipients = [];
    /**
     * Loop through recipients to check if outgoing mail needs to be encrypted 
     * based off recipient's email provider.
     */

    for (let i = 0; i < email.to.length; i++) {
      const regex = /\<(.*?)\>/g;

      const recipient = regex.exec(email.to[i])[1];
      const recipientDomain = recipient.split('@')[1];

      if (recipientDomain !== 'telios.io') {
        extRecipients = true;
        break;
      } else {
        recipients.push(recipient);
      }
    }

    // Insecure domains in recipient list
    if (extRecipients) {
      // TODO: Add send for non-encrypted emails
    } else {
    /** 
     * Encrypt outgoing mail as all recipients are using compatible mailboxes.
    */
      
    const res = await this.getMailboxPubKeys(recipients);

    // fs.writeFileSync(__dirname + '/encrypted.mail', msg);

    // // return encrypted metadata
    // const meta = {
    //   "key": key.toString('hex'),
    //   "pub": npub.toString('hex'),
    //   "drive": conf.MAILSERVER_DRIVE,
    //   "path": conf.MAILSERVER_DRIVE_PATH
    // };

    // const encryptedMeta = Mailbox._encryptMeta(meta, sbpkey, privKey);

    // console.log('Encrypted metadata :: ', encryptedMeta);

    // const sealedMsg = {
    //   "from": conf.BOB_SB_PUB_KEY,
    //   "meta": encryptedMeta
    // }

    // const encMsg = Crypto.encryptSealedBox(JSON.stringify(sealedMsg), sbpkey);

    // console.log('Final Message :: ', encMsg.toString('hex'));
    }
  }

  sendMailMeta(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.send_encrypted_mail
    });
  }

  async _encryptMail(opts) {
    const key = Crypto.generateAEDKey();
    const { npub, encrypted } = Crypto.encryptAED(key, email);

    const location = await this._storeSentMail(opts.drive, opts.drivePath, encrypted);

    return {
      location: location,
      key: key.toString('hex'),
      npub: npub.toString('hex')
    }
  }

  async _storeSentMail(name, path, msg) {
    const { v4: uuidv4 } = require('uuid');
    const location = `${path}/${uuidv4()}`;

    const hyperdrive = new Hyperdrive(name, { persist: true });
    await hyperdrive.connect();
    const drive = hyperdrive.drive;

    if (!await hyperdrive.dirExists(path)) {
      await drive.mkdir(path);
    }

    await drive.writeFile(location, msg);

    return location;
  }

  _encryptMeta(meta, sbpkey, privKey) {
    return Crypto.encryptSBMessage(JSON.stringify(meta), sbpkey, privKey);
  }

  markAsRead(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.mark_as_read
    });
  }
}

module.exports = Mailbox;