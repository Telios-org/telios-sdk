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
const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()

const account = new Account({
  provider: 'https://apiv1.telios.io'
})

// Verification code sent to the recovery email
const vcode = 'Xf1sP4'

const initPayload = {
  account: {
    account_key: secretBoxKeypair.publicKey,
    recovery_email: recoveryEmail,
    device_signing_key: signingKeypair.publicKey,
    device_drive_key: driveKey,
    device_peer_key: peerKeypair.publicKey,
    device_id: deviceId
  }
}

const { account, sig } = await Account.init(signingKeypair.privateKey, initPayload)

const registerPayload = {
  ...account,
  sig: sig,
  vcode: vcode
}

// Send the account object that was just signed to be stored and
// verified on the server for later authentication.
const res = await account.register(registerPayload)

```

# API/Examples

## `const account = new Account(provider)`
The Account class handles communication with the Telios server and provides methods for creating request payloads.

- `provider`: Base URL of the API provider

### `const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()`
Keypairs will need to be initially created before any other actions can be taken. These keys will be used for encrypting/decrypting data on the client and from other users. The private keys should be stored somewhere safe (and encrypted) and never shared. The public keys generated will be used for encrypting a recipient's data and can be shared publicly.

- `secretBoxKeypair`: Public/private keys for the account
- `signingKeypair`: Public/private signing keys for the account
- `peerKeypair`: Public/private keys for connecting with other peers

### `Account.init(acctPayload, privateKey)`
Prepares an account registration payload

- `acctPayload`: Account Object to be signed for registration
  - `account`
    - `account_key`: Public key for the account
    - `recovery_email`: Recovery email in plaintext. This is immediately hashed and stored once sent to the backend
    - `device_signing_key`: Public signing key for your device
    - `device_drive_key`: Public key of the drive created for the device `drive.publicKey`
    - `device_peer_key`: Public key used for connecting to other peers over plex/hyperswarm
    - `device_id`: UUID for this device
- `privateKey`: Private key for the account

### `await account.register(accountPayload)`
Registers a new account with the API server. This method requires a verification code (`vcode`) in order for the backend to create the account. Examples on how to generate verification codes are listed below.

- `acctPayload`: Account Object
  - `account`
    - `account_key`: Public key for the account
    - `recovery_email`: Recovery email in plaintext. This is immediately hashed and stored once sent to the backend
    - `device_signing_key`: Public signing key for your device
    - `device_drive_key`: Public key of the drive created for the device `drive.publicKey`
    - `device_peer_key`: Public key used for connecting to other peers over plex/hyperswarm
    - `device_id`: UUID for this device
  - `sig`: Signature returned from `Account.init`
  - `vcode`: Verification code sent to the recovery email.

Example: Get verfication code - This request will send a verification code in the form of a captcha image to the recovery email listed in the request.
```shell
curl --location --request POST 'https://apiv1.telios.io/account/captcha' --data-raw '{ "addr": "Kaylin_Farrell@email.com" }'
```

Example: Verifying the activation code
```shell
curl --location --request POST 'https://apiv1.telios.io/account/captcha/verify' --data-raw '{ "vcode": "Xf1sP4" }'
```


Account registration example usage:
```js
const { Account, Mailbox } = require('@telios/telios-sdk')
const { secretBoxKeypair, signingKeypair, peerKeypair } = Account.makeKeys()

const account = new Account({
  provider: 'https://apiv1.telios.io'
})

// Verification code sent to the recovery email
const vcode = 'Xf1sP4'

const initPayload = {
  account: {
    account_key: secretBoxKeypair.publicKey,
    recovery_email: recoveryEmail,
    device_signing_key: signingKeypair.publicKey,
    device_drive_key: driveKey,
    device_peer_key: peerKeypair.publicKey,
    device_id: deviceId
  }
}

const { account, sig } = await Account.init(signingKeypair.privateKey, initPayload)

const registerPayload = {
  ...account,
  sig: sig,
  vcode: vcode
}

// Send the account object that was just signed to be stored and
// verified on the server for later authentication.
const res = await account.register(registerPayload)
```

Example response:
```js
{
  // signature from server to be used for authentication
  _sig: '[server_signature]'
}
```
The `sig` returned will be required for authentication and should be stored and encrypted locally. This, along with the account's signing key will be used to create a unique access token for every request.

## `const drive = new Drive(storagePath, [key], [options])`
Create a drive to be shared over the network which can be replicated and seeded by other peers.

- `storagePath`: The directory where you want the drive to be created.
- `key`: The public key of the remote drive you want to clone

Options include:
```js
{
  // Peer keypair from Account.makeKeys()
  keyPair: { publicKey, secretKey }
}
```

```js
// Create a new local drive.
const localDrive = new Drive(__dirname + '/drive', null, { keyPair })

await localDrive.ready()

// Key to be shared with other devices or services that want to seed this drive
const drivePubKey = localDrive.publicKey

// Clone a remote drive
const remoteDrive = new Drive(__dirname + '/drive_remote', drivePubKey, { keyPair })

await remoteDrive.ready()
```

### `await drive.ready()`
Initialize the drive and all resources needed.

### `await drive.download(discoveryKey, files, [keyPair]);`

Connects to a remote drive and requests files to download and save locally.

- `discoveryKey`: Remote drive's discovery key `drive.discoveryKey` which is used by peers to request resources from the drive.
- `files`: An array of file objects with the following structure
  - `hash`: The hash of the file
- `keyPair`: Public private peer keypair. Required if the drive is using auth and only allows certain peers to connect and request files.

Example Usage:

```js
const { Drive } = require('@telios/telios-sdk')

const files = [
  { hash: fileHash }
]

const localDrive = new Drive(__dirname + '/drive', null, { keyPair })

localDrive.download(remoteDriveDiscoveryKey, files, {
  keyPair: peerKeypair
})

localDrive.on('file-download', (err, file) => {
  // File has finished syncing a file from remote to localDrive
})

localDrive.on('download-finished', () => {
  // All files passed to download() have finished syncing
})

localDrive.on('download-error', (err) => {
  // There's been an error syncing with the remote drive
})


```


### `await drive.close()`
Fully close the drive and all of it's resources.

### `drive.on('file-add', (file, enc) => {})`
Emitted when a new file has been added to a local drive.

- `file`: A file object
  - `path`: drive path the file was saved to
  - `hash`: Hash of the file
- `enc`: Passes back properties needed to decrypt the file
  - `key`: Key needed to decrypt the file
  - `header`: Needed for validated encrypted stream during decryption


### `drive.on('file-unlink', (file) => {})`
Emitted when a file has been deleted on the drive.

### `drive.on('file-download', (err, file) => {})`
Emitted when a file has been downloaded from the remote drive

### `drive.on('finished', () => {})`
Emitted when all files have finished downloading and saving locally

### `drive.on('error', (err) => {})`
Emitted when there has been an error downloading from the remote drive

## `const mailbox = new Mailbox(provider, auth)`
The Mailbox class provides functionality needed for processing encrypted emails.

- `provider`: Base URL of the API provider
- `auth`
  - `claims`
    - `device_signing_key`:
    - `account_key`:
    - `device_peer_key`:
    - `device_id`:
  - `device_signing_priv_key`:
  - `sig`: Signature sent from the Telios server when this account was registered.

Example Usage:
``` js
const mailbox = new Mailbox({
  provider: 'https://apiv1.telios.io',
  auth: {
    claims: {
      device_signing_key: signingKeypair.publicKey,
      account_key: secretBoxKeypair.publicKey,
      device_peer_key: peerKeypair.publicKey,
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

### `await mailbox.getMailboxPubKeys(addresses)`
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

### `mailbox.send(email, { privKey, pubKey, drive, filePath })`
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
- `dest`: File destination path on the local drive

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
  // Destination path of the file on the local drive
  dest: '/email/email.json'
})

```

### `await mailbox.getNewMail(acctPrivKey, acctPubKey)`

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

### `await mailbox.markAsSynced(ids)`
After an email has been pulled down onto your local devices its meta record can be safely removed from the server.

- `ids`: an array of meta message ids on the server

Example usage:
``` js
// Pass in an array of message IDs to be marked as synced.
const res = await mailbox.markAsSynced(["5f1210b7a29fe6222f199f80"])
```
