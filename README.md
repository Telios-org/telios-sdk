# Telios Client SDK
[![Build Status](https://travis-ci.org/Telios-org/telios-sdk.svg?branch=master)](https://travis-ci.org/Telios-org/telios-sdk)
[![Current Version](https://img.shields.io/github/package-json/v/Telios-org/telios-sdk)](https://github.com/Telios-org/telios-sdk)
[![GitHub Issues](https://img.shields.io/github/issues/Telios-org/telios-sdk/open)](https://github.com/Telios-org/telios-sdk/issues)

### ⚠️ This is an experimental package that is not yet intended for production use. Use at your own risk ⚠️

This package provides components for building an email client using the [Telios Network](https://www.telios.io). Telios is an offline-capabale e2e encrypted email service built on [hypercore-protocol](https://hypercore-protocol.org/) for sending and receiving emails.

## What does this SDK do?

This SDK provides methods for interacting with the Telios Client-Server API. It comes with everything needed for sending/receiving encrypted data, registering a new account, creating mailboxes, and creating shared drives.


## Installation

``` js
npm i @telios/telios-sdk
```

## Usage

``` js
const { Account, Mailbox } = require('@telios/telios-sdk')

const acct = new Account({
  provider: 'https://apiv1.telios.io'
});

const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()

const opts = {
  account: {
    device_signing_key: signingKeypair.publicKey,
    account_key: secretBoxKeypair.publicKey,
    peer_key: peerKeypair.publicKey,
    recovery_email: recoveryEmail
  }
};

const { account, sig } = await Account.init(opts, signingKeypair.privateKey)

const res = await acct.register({ account, sig })
```

## API/Examples

### `const account = new Account(provider)`
The Account class handles communication with the Telios server and provides methods for creating request payloads.

- `provider`: Base URL of the API provider

#### `const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()`
Keypairs will need to be initially created before any other actions can be taken. These keys will be used for encrypting/decrypting data on the client and from other users. The private keys should be stored somewhere safe (and encrypted) and never shared. The public keys generated will be used for encrypting a recipient's data and can be shared publicly.

- `secretBoxKeypair`: Public/private keys for the account
- `signingKeypair`: Public/private signing keys for the account
- `peerKeypair`: Public/private keys for connecting with other peers

#### `Account.init(acctPayload, privateKey)`
Prepares an account registration payload

- `acctPayload`: Account Object to be signed for registration
  - `account`
    - `device_signing_key`: Public signing key for your device
    - `account_key`: Public key for the account
    - `peer_key`: Public key used for connecting to other peers over plex/hyperswarm
    - `recovery_email`: Recovery email in plaintext. This is immediately hashed and stored once sent to the backend
- `privateKey`: Private key for the account

#### `await account.register(account, sig)`

Example usage:
```js
const { Account, Mailbox } = require('@telios/telios-sdk')
const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()

const account = new Account({
  provider: 'https://apiv1.telios.io'
})

const accountPayload = {
  account: {
    device_signing_key: signingKeypair.publicKey,
    account_key: secretBoxKeypair.publicKey,
    peer_key: peerKeypair.publicKey,
    recovery_email: recoveryEmail
  }
}

const { account, sig } = await Account.init(signingKeypair.privateKey, accountPayload)

// Send the account object that was just signed to be stored and verified
// on the server for later authentication.
const res = await account.register(account, sig)
```

Example response:
```js
{
  // signature from server to be used for authentication
  _sig: '[server_signature]'
}
```
The `sig` returned will be required for authentication and should be stored and encrypted locally. This replaces the need for requiring a username and password for authentication.

### `const drive = new Drive(storagePath, [key], [options])`
Create a drive to be shared over the network which can be replicated and seeded by other peers.

- `storagePath`: The directory where you want the drive to be created.
- `key`: The public key of the remote drive you want to clone

Options include:
```js
{
  keyPair: { publicKey, secretKey }, // Peer keypair
  ignore: /(^|[\/\\])\../, // File pattern to ignore in drivePath
  seed: true|false, // Default true. Announce this drive and serve it's contents to requesting peers
  watch: true|false, // Default true. Watch for local changes and notify connected peers.
                     // Set this to false for drives that only intend to seed and not write.
}
```

```js
// Create a new local drive. If any files exist in this drive
// they will automatically be added over the network
const localDrive = new Drive(__dirname + '/drive', null, { keyPair })

await localDrive.ready()

const drivePubKey = localDrive.publicKey

// Clone a remote drive
const remoteDrive = new Drive(__dirname + '/drive_remote', drivePubKey, { keyPair })

await remoteDrive.ready()
```

#### `drive.ready()`

#### `drive.addPeer()`

#### `drive.removePeer()`


### `const mailbox = new Mailbox(provider, auth)`
The Mailbox class provides functionality needed for processing encrypted emails.

- `provider`: Base URL of the API provider
- `auth`
  - `claims`
    - `device_signing_key`:
    - `account_key`:
    - `peer_key`:
    - `device_id`:
  - `device_signing_priv_key`:
  - `sig`:

Example Usage:
``` js
const mailbox = new Mailbox({
  provider: 'https://apiv1.telios.io',
  auth: {
    claims: {
      device_signing_key: signingKeypair.publicKey,
      account_key: secretBoxKeypair.publicKey,
      peer_key: peerKeypair.publicKey,
      device_id: '[device_id]'
    },
    device_signing_priv_key: signingKeypair.privateKey,
    sig: '[sig]'
  }
})

const payload = {
  account_key: secretBoxKeypair.publicKey,
  addr: 'test@telios.io'
}

const res = await mailbox.registerMailbox(payload)
```

Example response:
```js
{
  "registered": true
}
```

#### `await mailbox.getMailboxPubKeys(addresses)`
A recipient's account's public key is required for sending encrypted emails within the Telios network. `getMailboxPubKeys` takes an array of recipient's addresses and returns their corresponding public key.

- `addresses`: An array of email addresses

Example usage:
``` js
const res = await mailbox.getMailboxPubKeys(['alice@telios.io', 'tester@telios.io'])
```

Example response:
```js
[
  {
    address: 'alice@telios.io',
    account_key: '[account_public_key]'
  },
  {
    address: 'tester@telios.io',
    account_key: '[account_public_key]'
  }
]
```

#### `mailbox.send(email, { privKey, pubKey, drive, drivePath })`
When sending an email to multiple recipients, the recipient's email domain is checked
if it matches telios.io. In this case the email is encrypted, stored on the local drive, and an encrypted message
is sent that only the recipient can decipher. The deciphered metadata gives the recipient instructions
how to to retrieve and decipher thier encrypted email.

In the instance of multiple recipients from non-compatible email providers (gmail, yahoo, etc..), the email
is initially sent without encryption via normal SMTP. The reason for this is it doesn't make sense to encrypt an email that's
being sent in cleartext to other recipients. If some of the recipients are using telios.io, the email **WILL**
be encrypted at rest when picked up by the mailserver for Telios recipients.

- `email`: An email in JSON format
- `privKey`: The sender's private key (Bob). Private key is only used during encryption and never sent or stored.
- `pubKey`: The sender's public key (Bob). Public key is used for authenticity of sender
- `drive`: A shared drive
- `drivePath`: The directory where the local drive stores it's encrypted emails.

Email JSON should be in the following format:
```js
{
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
```

Example usage:
``` js
// In this example Bob is sending an ecrypted email to two other Telios mailboxes.
const res = await mailbox.send(email, {
  // The sender's private key (Bob). Private key is only used during encryption and never sent or stored.
  privKey: '[bob_account_private_key]',

  // The sender's public key (Bob). Public key is used for authenticity of sender
  pubKey: '[bob_account_public_key]',

  // A Shared Drive.
  drive: '[drive]',

  // This is the directory where the local drive stores it's encrypted emails. 
  // In the example below, the sender (Bob) placed an email file named 3ff78ec3-2964-44c5-97fe-13875f97c040.json
  // in the root of the referenced hyperdrive. Each email is dynamically named with a guid for 
  // added privacy. When the other recipients decode their metadata sent 
  // to them via Bob, they will use this drive/path to retrieve their email.
  drivePath: '/3ff78ec3-2964-44c5-97fe-13875f97c040.json'
})

```

#### `await mailbox.getNewMail(acctPrivKey, acctPubKey)`

- `acctPrivKey`: Your account's private key
- `acctPubKey`: Your account's public key

Example usage:
``` js
const acctPubKey = '[account_public_key]'
const acctPrivKey = '[account_private_key]'

const mail = await mailbox.getNewMail(acctPrivKey, acctPubKey)
```

Example response:
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

#### `await mailbox.markAsSynced(ids)`

- `ids`: an array of meta message ids on the server

Example usage:
``` js
/**
 * Pass in an array of message IDs to be marked as read
 */
const res = await mailbox.markAsSynced(["5f1210b7a29fe6222f199f80"])
```
