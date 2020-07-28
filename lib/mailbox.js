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

  registerAlias(name) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: { addr: name },
      route: routes.mailbox.register_alias
    });
  }

  removeAlias(name) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: { addr: name },
      route: routes.mailbox.remove_alias
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
      promises.push(this._decryptMail(newMail.data[i], privKey, sbpkey));
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

  async _decryptMail(sealedMeta, privKey, sbpkey) {
    const msg = JSON.parse(Crypto.decryptSealedBox(sealedMeta.msg, privKey, sbpkey));
    const meta = JSON.parse(Crypto.decryptSBMessage(msg.meta, msg.from, privKey));

    const opts = {
      name: meta.drive,
      driveOpts: {
        persist: false
      }
    }

    const hyperdrive = new Hyperdrive(opts);
    await hyperdrive.connect();
    const email = await hyperdrive.readEncryptedMail(meta);

    return {
      _id: sealedMeta._id,
      email: email
    }
  }

  /**
   * When sending an email to multiple recipients, the recipient's email domain is checked
   * for whether or not their inbox is telios.io or a provider that's using the same encryption
   * protocol. In this case the email is encrypted, stored on the local drive, and an encrypted message
   * is sent that only the recipient can decipher. The deciphered metadata gives the recipient instructions
   * how to to retrieve and decipher thier encrypted email.
   * 
   * In the instance of multiple recipients from non-compatible email providers (gmail, yahoo, etc..), the email
   * is initially sent without encryption via normal SMTP. The reason for this is it doesn't make sense to encrypt an email that's
   * being sent in cleartext to other recipients. If some of the recipients are using telios.io, the email WILL
   * be encrypted at rest when picked up by the mailserver for Telios recipients.
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
      const mailMeta = [];
      const { location, key, npub } = this._encryptMail(email, opts);
      
      const res = await this.getMailboxPubKeys(recipients);
    
      for (let i = 0; i < res.data.length; i++) {
        const sbpkey = res.data[i].sbpkey;
        const meta = {
          "key": key,
          "pub": npub,
          "drive": opts.drive,
          "path": location
        };

        const encryptedMeta = this._encryptMeta(meta, sbpkey, opts.privKey);
        const encMsg = this._sealMeta(encryptedMeta, opts.pubKey);

        mailMeta.push({ sbpkey: sbpkey, msg: encMsg.toString('hex') });
      }

      return this._sendMailMeta(mailMeta);
    }
  }

  _sendMailMeta(payload) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.send_encrypted_mail
    });
  }

  async _encryptMail(email, opts) {
    email = JSON.stringify(email);

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

    const opts = {
      name: name,
      driveOpts: {
        persist: true
      }
    };

    const hyperdrive = new Hyperdrive(opts);
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

  _sealMeta(encryptedMeta, sbpkey) {
    const sealedMsg = {
        "from": sbpkey,
        "meta": encryptedMeta
      }

    return Crypto.encryptSealedBox(JSON.stringify(sealedMsg), sbpkey);
  }

  markAsRead(idArr) {
    return callout({
      provider: this.provider,
      token: this.opts.token,
      payload: { "msg_ids": idArr },
      route: routes.mailbox.mark_as_read
    });
  }
}

module.exports = Mailbox;