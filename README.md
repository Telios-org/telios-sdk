# Telios Client SDK
[![Build Status](https://travis-ci.org/Telios-org/telios-sdk.svg?branch=master)](https://travis-ci.org/Telios-org/telios-sdk)
[![Current Version](https://img.shields.io/github/package-json/v/Telios-org/telios-sdk)](https://github.com/Telios-org/telios-sdk)
[![GitHub Issues](https://img.shields.io/github/issues/Telios-org/telios-sdk/open)](https://github.com/Telios-org/telios-sdk/issues)

### ⚠️ This is an experimental package that is not yet intended for production use. Use at your own risk ⚠️

This package provides components for building an email client using the Telios Network. Telios is an offline-capabale e2e encrypted email service built on [hypercore-protocol](https://hypercore-protocol.org/) for sending and receiving emails.

## What does this SDK do?

This SDK provides methods for interacting with the Telios Client-Server API. It comes with everything needed for sending/receiving encrypted data, registering a new account, creating mailboxes, and registering aliases.


## Installation

``` js
npm i @telios/telios-sdk
```

## Usage

``` js
const { HyperSession, Account, Mailbox } = require('@telios/telios-sdk');
const hyperSession = new HyperSession();

const acct = new Account({
  provider: 'telios.io'
});

const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys();

const session = await hyperSession.add('Alice Session', {
  storage: __dirname + '/storage',
  databases: [
      'Cores',
      'Drives',
      'Email',
      'Contacts',
      'Files'
    ],
    bootstrap: [
      'Cores',
      'Drives'
    ]
});

const opts = {
  account: {
    device_signing_key: signingKeypair.publicKey,
    sbpkey: secretBoxKeypair.publicKey,
    peer_key: peerKeypair.publicKey,
    recovery_email: recoveryEmail
  }
};

const { account, sig } = await Account.init(opts, signingKeypair.privateKey);

const res = await acct.register({ account, sig });
```

## Account
The Account object handles communication with the Telios server and provides methods for creating request payloads.

### Create Keypairs
Keypairs will need to be initially created before any other actions can be taken. These keys will be used for encrypting/decrypting data on the client. The private keys should be stored somewhere safe (and encrypted) and never shared. The public keys generated will be used for encrypting a recipient's data and can be shared publicly.

``` js
const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys();

const secret_box_pub_key = secretBoxKeypair.publicKey;
const secret_box_priv_key = secretBoxKeypair.privateKey;

const signing_pub_key = signingKeypair.publicKey;
const signing_priv_key = signingKeypair.privateKey;

const peer_pub_key = peerKeypair.publicKey;
const peer_priv_key = peerKeypair.privateKey;
```

### Register a New Account

```js
const { HyperSession, Account, Mailbox } = require('@telios/telios-sdk');
const hyperSession = new HyperSession();
const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys();

const account = new Account({
  provider: 'telios.io'
});

const session = await hyperSession.add('Alice Session', {
  // Local path to where the drive should be stored
  storage: __dirname + '/storage',
  databases: [
      'Cores',
      'Drives',
      'Email',
      'Contacts',
      'Files'
    ],
    bootstrap: [
      'Cores',
      'Drives'
    ]
});

const opts = {
  account: {
    device_signing_key: signingKeypair.publicKey,
    sbpkey: secretBoxKeypair.publicKey,
    peer_key: peerKeypair.publicKey,
    recovery_email: recoveryEmail
  }
};

const { account, sig } = await Account.init(opts, signingKeypair.privateKey);

// Send the account object that was just signed to be stored and verified
// on the server for later authentication.
const res = await account.register({ account, sig });
```

#### Example response:
```js
{
  // signature from server to be used for authentication
  _sig: '[server_signature]'
}
```
The `sig` returned will be required for authentication and should be stored and encrypted locally. This replaces the need for requiring a username and password for authentication.

## Mailbox
The Mailbox object provides functionality needed for processing encrypted emails.

### Register a New Mailbox

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

const payload = {
  sbpkey: '[secret_box_public_key]',
  addr: 'test@telios.io'
};

const res = await mailbox.registerMailbox(payload);
```

#### Example response:

```js
{
  "registered": true
}
```

### Register a New Alias
`registerAlias` only requires the full alias address passed in as a string. All mail sent to this address will automatically forward to the main mailbox.

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

const res = await mailbox.registerAlias('alice-netflix@telios.io');
```

#### Example response:

```js
{
  "registered": true
}
```

### Remove an Alias

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

const res = await mailbox.removeAlias('alice-netflix@telios.io');
```

#### Example response:

```js
{
  "removed": true
}
```

### Retrieve Mailbox Public Keys
A recipient's public key is required for sending encrypted emails within the Telios network. `getMailboxPubKeys` takes an array of recipient addresses and returns their corresponding public keys to be used for encrypting data sent to them.

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

const res = await mailbox.getMailboxPubKeys(['alice@telios.io', 'tester@telios.io']);
```

#### Example response:

```js
[
  {
    address: 'alice@telios.io',
    sbpkey: '[secret_box_public_key]'
  },
  {
    address: 'tester@telios.io',
    sbpkey: '[secret_box_public_key]'
  }
]
```

### Sending Emails

When sending an email to multiple recipients, the recipient's email domain is checked
for whether or not their inbox is telios.io or a provider that's using the same encryption
protocol. In this case the email is encrypted, stored on the local drive, and an encrypted message
is sent that only the recipient can decipher. The deciphered metadata gives the recipient instructions
how to to retrieve and decipher thier encrypted email.

In the instance of multiple recipients from non-compatible email providers (gmail, yahoo, etc..), the email
is initially sent without encryption via normal SMTP. The reason for this is it doesn't make sense to encrypt an email that's
being sent in cleartext to other recipients. If some of the recipients are using telios.io, the email **WILL**
be encrypted at rest when picked up by the mailserver for Telios recipients.

``` js
// In this example Bob is sending an ecrypted email to two other Telios mailboxes.

const mailbox = new Mailbox({
  provider: 'telios.io'
});

const email = {
  "subject": "Hello Bob",
  "date": "2020-07-14T13:49:36.000Z",
  "to": [
    {
      "address": "bob@mail.com",
      "name": "Bob"
    }
  ],
  "from": [
    {
      "address": "alice@mail.com",
      "name": "Alice"
    }
  ],
  "cc": [],
  "bcc": [],
  "sender": [],
  "text_body": "You're my favorite test person ever",
  "html_body": "<h1>You're my favorite test person ever</h1>",
  "attachments": [
    {
        "filename": "test.pdf",
        "fileblob": "--base64-data--",
        "mimetype": "application/pdf"
    },
    {
        "filename": "test.txt",
        "fileblob": "--base64-data--",
        "mimetype": "text/plain"
    }
  ]
}

const res = await mailbox.send(email, {
  // The sender's private key (Bob). Private key is only used during encryption and never sent or stored.
  privKey: '[bob_secret_box_private_key]',

  // The sender's public key (Bob). Public key is used for authenticity of sender
  pubKey: '[bob_secret_box_public_key]',

  // A Hyperdrive object.
  drive: '[Hyperdrive]',

  // This is the directory where the local drive stores it's encrypted emails. 
  // In the example below, the sender (Bob) placed an email file named 3ff78ec3-2964-44c5-97fe-13875f97c040.json
  // in the root of the referenced hyperdrive. Each email is dynamically named with a guid for 
  // added privacy. When the other recipients decode their metadata sent 
  // to them via Bob, they will use this drive/path to retrieve their email.
  drivePath: '/3ff78ec3-2964-44c5-97fe-13875f97c040.json'
});

```

### Retrieve New Emails

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

const sbpkey = '[client_secretbox_private_key]';
const privKey = '[client_secretbox_public_key]';

const mail = await mailbox.getNewMail(privKey, sbpkey);
```

#### Example response:

```js
[
  {
    "headers": [
      {
        "header": "x-spam-score",
        "value": "1.9"
      }
    ],
    "subject": "Hello Bob",
    "date": "2020-07-14T13:49:36.000Z",
    "to": [
      {
        "address": "bob@mail.com",
        "name": "Bob"
      }
    ],
    "from": [
      {
        "address": "alice@mail.com",
        "name": "Alice"
      }
    ],
    "cc": [],
    "bcc": [],
    "sender": [],
    "text_body": "You're my favorite test person ever",
    "html_body": "<h1>You're my favorite test person ever</h1>",
    "attachments": [
      {
          "filename": "test.pdf",
          "fileblob": "--base64-data--",
          "mimetype": "application/pdf"
      },
      {
          "filename": "test.txt",
          "fileblob": "--base64-data--",
          "mimetype": "text/plain"
      }
    ]
  }
]
```

### Mark Emails as Synced

``` js
const mailbox = new Mailbox({
  provider: 'telios.io'
});

/**
 * Pass in an array of message IDs to be marked as read
 */
const res = await mailbox.markAsSynced(["5f1210b7a29fe6222f199f80"]);
```
