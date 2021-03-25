const callout = require('./callout');
const routes = require('./routes');
const Client = require('./client');
const Crypto = require('./crypto');
const fs = require('fs');
const { parser } = require('../util/mailparser');
const ram = require('random-access-memory');
const path = require('path');
const MemoryStream = require('memorystream');

class Mailbox extends Client {
  constructor(opts) {
    super(opts);
  }

  registerMailbox(payload) {    
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: payload,
      route: routes.mailbox.register
    });
  }

  registerAlias(name) {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: { addr: name },
      route: routes.mailbox.register_alias
    });
  }

  removeAlias(name) {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: { addr: name },
      route: routes.mailbox.remove_alias
    });
  }

  getMailboxPubKeys(addresses) {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: null,
      route: routes.mailbox.get_public_key,
      param: addresses
    });
  }

  async getNewMail(privKey, acctPubKey) {
    const newMail = await this.getNewMailMeta();
    const metaList = [];

    for (let i = 0; i < newMail.length; i++) {
      metaList.push(this._decryptMailMeta(newMail[i], privKey, acctPubKey));
    }

    return metaList;
  }

  getNewMailMeta() {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: null,
      route: routes.mailbox.get_new_mail
    });
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
     * 
     * TODO: Remove hardcoded telios.io domain to support federation.
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
      
      const { v4: uuidv4 } = require('uuid');
      const uuid = uuidv4();
      const location = `${opts.filePath}${uuid}_enc.json`;

      const stream = new MemoryStream();
      stream.end(JSON.stringify(email));

      const { key, header, file } = await opts.drive.writeFile(location, { readStream: stream , encrypted: true });

      const mailboxes = await this.getMailboxPubKeys(recipients);

      for (let i = 0; i < mailboxes.length; i++) {
        const acctPubKey = mailboxes[i].account_key;
        const meta = {
          "key": key,
          "header": header,
          "drive_key": opts.drive.publicKey,
          "hash": file.hash,
          "name": file.fileName,
          "size": file.size
        };

        const encryptedMeta = this._encryptMeta(meta, acctPubKey, opts.privKey);
        const encMsg = this._sealMeta(encryptedMeta, opts.pubKey, acctPubKey);

        mailMeta.push({ account_key: acctPubKey, msg: encMsg.toString('hex') });
      }

      return this._sendMailMeta(mailMeta);
    }
  }

  _sendMailMeta(payload) {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: payload,
      route: routes.mailbox.send_encrypted_mail
    });
  }

  _sendExternalMail(payload) {
    return callout({
      event: this,
      provider: this.provider,
      auth: this.opts.auth,
      payload: payload,
      route: routes.mailbox.send_external_mail
    });
  }

  _decryptMailMeta(sealedMeta, privKey, acctPubKey) {
    let email = "";
    const msg = JSON.parse(Crypto.decryptSealedBox(sealedMeta.msg, privKey, acctPubKey));
    const meta = JSON.parse(Crypto.decryptSBMessage(msg.meta, msg.from, privKey));

    return meta;
  }

  async _encryptStream(readStream, writeStream, opts) {
    const key = Crypto.generateStreamKey();
    let { state, header } = Crypto.initStreamPushState(key);
    writeStream.write(header);

    // This will wait until we know the readable stream is actually valid before piping
    readStream.on('data', function (chunk) {
      const data = Crypto.secretStreamPush(chunk, state);
      writeStream.write(data);
    });

    return new Promise((resolve, reject) => {
      readStream.on('end', function () {
        writeStream.end();
      });

      opts.drive.on('file-add', file => {
        if(file.source === 'local') {
          resolve({ file, key: key.toString('hex'), header: header.toString('hex')});
        }
      })

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
    const { hash } = await this._storeSentMail(opts.drive, opts.filePath, encrypted);
    
    return {
      hash,
      key: key.toString('hex'),
      npub: npub.toString('hex')
    }
  }

  async _storeSentMail(drive, filePath, msg) {
    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    const location = `${filePath}${uuid}`;

    fs.writeFileSync(path.join(drive.drivePath, location), msg);

    return new Promise((resolve, reject) => {
      drive.on('file-add', file => {
        if(file.source === 'local') {
          resolve(file);
        }
      });
    });
  }

  _encryptMeta(meta, acctPubKey, privKey) {
    return Crypto.encryptSBMessage(JSON.stringify(meta), acctPubKey, privKey);
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
      auth: this.opts.auth,
      payload: { "msg_ids": idArr },
      route: routes.mailbox.mark_as_synced
    });
  }
}

module.exports = Mailbox;