const callout = require('./callout');
const routes = require('./routes');
const Client = require('./client');
const Hyperdrive = require('./hyperdrive');
const Crypto = require('./crypto');
const fs = require('fs');
const { parser } = require('../util/mailparser');
const ram = require('random-access-memory');


class Mailbox extends Client {
  constructor(opts) {
    super(opts);

    this.on('tokenRefreshed', (token) => {
      opts.onTokenRefresh(token);
    });
  }

  registerMailbox(payload) {    
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.register
    });
  }

  registerAlias(name) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: { addr: name },
      route: routes.mailbox.register_alias
    });
  }

  removeAlias(name) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: { addr: name },
      route: routes.mailbox.remove_alias
    });
  }

  getMailboxPubKeys(addresses) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_public_key,
      param: addresses
    });
  }

  async getNewMail(privKey, sbpkey) {
    const newMail = await this.getNewMailMeta();
    const promises = [];

    for (let i = 0; i < newMail.length; i++) {
      try {
        promises.push(await this.decryptMail(newMail[i], privKey, sbpkey));
      } catch (err) {
        // connection to hyperdrive timed out
      }
    }

    return Promise.all(promises);
  }

  getNewMailMeta() {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: null,
      route: routes.mailbox.get_new_mail
    });
  }

  async decryptMail(sealedMeta, privKey, sbpkey) {
    const SDK = require('dat-sdk');
    const sdk = await SDK({
      storage: ram
    });

    let email = "";
    const msg = JSON.parse(Crypto.decryptSealedBox(sealedMeta.msg, privKey, sbpkey));
    const meta = JSON.parse(Crypto.decryptSBMessage(msg.meta, msg.from, privKey));

    const opts = {
      name: meta.drive,
      sdk: sdk,
      opts: {
        persist: false
      }
    }

    const hyperdrive = new Hyperdrive(opts);
    await hyperdrive.connect();
    
    if (meta.hasOwnProperty('header')) {
      email = await hyperdrive.readEncryptedStream(meta);
    } else {
      email = await hyperdrive.readEncryptedMail(meta);
    }

    await sdk.close();
    await hyperdrive.close();


    if (typeof email !== 'object') {
      email = await parser(email);
    }

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
      const recipient = email.to[i].address;
      const recipientDomain = email.to[i].address.split('@')[1];

      if (recipientDomain !== 'telios.io') {
        extRecipients = true;
        break;
      } else {
        recipients.push(recipient);
      }
    }

    if (email.cc && email.cc.length > 0) {
      for (let i = 0; i < email.cc.length; i++) {
        const recipient = email.cc[i].address;
        const recipientDomain = recipient.split('@')[1];

        if (recipientDomain !== 'telios.io') {
          extRecipients = true;
          break;
        } else {
          recipients.push(recipient);
        }
      }
    }

    if (email.bcc && email.bcc.length > 0) {
      for (let i = 0; i < email.bcc.length; i++) {
        const recipient = email.bcc[i].address;
        const recipientDomain = recipient.split('@')[1];

        if (recipientDomain !== 'telios.io') {
          extRecipients = true;
          break;
        } else {
          recipients.push(recipient);
        }
      }
    }

    // Insecure domains in recipient list
    if (extRecipients) {
      return this._sendExternalMail(email);
    } else {
      /** 
       * Encrypt outgoing mail as all recipients are using compatible mailboxes.
      */
      const mailMeta = [];
      const { driveKey, location, key, npub } = await this._encryptMail(email, opts);
      
      const mailboxes = await this.getMailboxPubKeys(recipients);

      for (let i = 0; i < mailboxes.length; i++) {
        const sbpkey = mailboxes[i].sbpkey;
        const meta = {
          "key": key,
          "pub": npub,
          "drive": `hyper://${driveKey}`,
          "path": location
        };

        const encryptedMeta = this._encryptMeta(meta, sbpkey, opts.privKey);
        const encMsg = this._sealMeta(encryptedMeta, opts.pubKey, sbpkey);

        mailMeta.push({ sbpkey: sbpkey, msg: encMsg.toString('hex') });
      }

      return this._sendMailMeta(mailMeta);
    }
  }

  _sendMailMeta(payload) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.send_encrypted_mail
    });
  }

  _sendExternalMail(payload) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: payload,
      route: routes.mailbox.send_external_mail
    });
  }

  async _encryptStream(filePath, writeStream) {
    const key = Crypto.generateStreamKey();
    const BUFFER_SIZE = 8192;
    const readStream = fs.createReadStream(filePath, { highWaterMark: BUFFER_SIZE });

    let { state, header } = Crypto.initStreamPushState(key);
    writeStream.write(header);

    // This will wait until we know the readable stream is actually valid before piping
    readStream.on('data', function (chunk) {
      const data = Crypto.secretStreamPush(chunk, state);
      writeStream.write(data);
    });

    return new Promise((resolve, reject) => {
      readStream.on('close', function () {
        writeStream.end();
        resolve({ key: key.toString('hex'), header: header.toString('hex')});
      });

      readStream.on('error', function (err) {
        console.log('STREAM ERROR :: ', err);
        reject(err);
      });
    });
  }

  async _encryptMail(email, opts) {
    email = JSON.stringify(email);
    const key = Crypto.generateAEDKey();
    const { npub, encrypted } = Crypto.encryptAED(key, email);
    const { driveKey, location } = await this._storeSentMail(opts.drive, opts.drivePath, encrypted);
    
    return {
      driveKey: driveKey,
      location: location,
      key: key.toString('hex'),
      npub: npub.toString('hex')
    }
  }

  async _storeSentMail(hyperdrive, path, msg) {
    const { v4: uuidv4 } = require('uuid');
    const location = `${path}/${uuidv4()}`;
    const drive = hyperdrive.drive;
    
    await drive.writeFile(location, msg);

    return { driveKey: drive.key.toString('hex'), location: location };
  }

  _encryptMeta(meta, sbpkey, privKey) {
    return Crypto.encryptSBMessage(JSON.stringify(meta), sbpkey, privKey);
  }

  _sealMeta(encryptedMeta, fromPubKey, toPubKey) {
    const sealedMsg = {
        "from": fromPubKey,
        "meta": encryptedMeta
      }

    return Crypto.encryptSealedBox(JSON.stringify(sealedMsg), toPubKey);
  }

  markAsSynced(idArr) {
    return callout({
      event: this,
      provider: this.provider,
      token: this.opts.token,
      payload: { "msg_ids": idArr },
      route: routes.mailbox.mark_as_synced
    });
  }
}

module.exports = Mailbox;