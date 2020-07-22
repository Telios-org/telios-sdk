# Telios Client SDK
[![Build Status](https://travis-ci.org/Telios-org/telios-sdk.svg?branch=master)](https://travis-ci.org/Telios-org/telios-sdk)
[![Current Version](https://img.shields.io/github/package-json/v/Telios-org/telios-sdk)](https://github.com/Telios-org/telios-sdk)
[![GitHub Issues](https://img.shields.io/github/issues/Telios-org/telios-sdk/open)](https://github.com/Telios-org/telios-sdk/issues)

This SDK can be used to build your own client for communicating with the Telios network. Telios is an offline-capabale e2e encrypted email service that uses p2p technology for sending and receiving emails.

## What does this SDK do?

This SDK provides methods for interacting with the Telios Client-Server API. This SDK comes with everything needed for sending/receiving encrypted data, registering a new account, creating mailboxes, and registering aliases.


## Installation

``` js
npm install telios-sdk
```

## Usage

``` js
const { Account, Mailbox } = require('telios-sdk');
const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const account = new Account({
  provider: 'telios.io'
});

const payload = await Account.init({
  spkey: signingKeypair.publicKey,
  sbpkey: secretBoxKeypair.publicKey,
  recovery_email: 'test@telios.io'
});

const res = await account.register(payload);
```

## Account
The Account object handles communication with the Telios server and provides methods for creating request payloads.

### Create Keypairs
Keypairs will need to be initially created before any other actions can be taken. These keys will be used for encrypting/decrypting data on the client. The private keys should be stored somewhere safe (and encrypted) and never shared. The public keys generated will be used for encrypting a recipient's data and can be shared publicly.

``` js
const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const secret_box_pub_key = secretBoxKeypair.publicKey;
const secret_box_priv_key = secretBoxKeypair.privateKey;

const signing_pub_key = signingKeypair.publicKey;
const signing_priv_key = signingKeypair.privateKey;
```

### Register a New Account
After a successful registration, the server will create a seed `drive` and return this to the client. This `drive` will seed the user's data when all devices are disconnected. This is would be required in a situation where a client attempts to retrieve an email from a device that is now offline.

```js
const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const account = new Account({
  provider: 'telios.io'
});

const payload = await Account.init({
  spkey: signingKeypair.publicKey,
  sbpkey: secretBoxKeypair.publicKey,
  recovery_email: 'test@telios.io'
});

const res = await account.register(payload);
```

#### Example response:
```js
{
  drive: '[drive]', // The seed drive public key
  sig: '[server_signature]'
}
```
The `sig` returned will be required for authentication and should be stored and encrypted locally. This essentially replaces the need for requiring a username and password for authentication.

### Account Login
```js
// Instantiate a new Account object
const account = new Account({
  provider: 'telios.io'
});

// Create an account payload and then sign with your public signing key
const account = {
  spkey: '[signing_public_key]',
  sbpkey: '[secret_box_public_key]',
  device_id: '[device_id]',
  sig: '[server_signature>]'
};

// Sign account
const auth_payload = Account.accountSignAuth(account);

// Authenticate with auth payload
const res = await account.register(auth_payload);
```

#### Example response:

```js
{
    "access_token": '[jwt_token]'
}
```
The `access_token` returned will be required for all protected routes and should be stored and encrypted locally.

### Account Logout

```js
// Instantiate a new Account object
const account = new Account({
  provider: 'telios.io'
});

// the 'all' option will log out all devices
const payload = { devices: 'all' };

// Pass in current token
const token = '[jwt_token]';

// Logout
const res = await account.logout(token, payload);
```

## Mailbox
The Mailbox object provides functionality needed for processing encrypted emails.

### Register a New Mailbox

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

const payload = {
  sbpkey: '[secret_box_public_key]',
  addr: 'test@telios.io',
  pwd: '[password]'
};

const res = await mailbox.registerMailbox(payload);
```

#### Example response:

```js
{
    "registered": true
}
```

### Retrieve a Mailbox's Public Key
A recipient's public key is required for sending encrypted emails within the Telios network. A separate email will need to be encrypted for each recipient.

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

const addr = {
  addr: 'user@telios.io'
};

const res = await mailbox.registerMailbox(addr);
```

#### Example response:

```js
{
    "sbpkey": '[secret_box_public_key]'
}
```

### Sending Emails

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

const email = {
  to: ["Test Person <test@example.com>"],
  sender: "Test Persons Friend <friend@telios.io>",
  subject: "Hello Test Person",
  text_body: "You're my favorite test person ever",
  html_body: "<h1>You're my favorite test person ever</h1>",
  custom_headers: [
    {
      header: "Reply-To",
      value: "Actual Person <test3@telios.io>"
    }
  ],
  attachments: [
      {
          filename: "test.pdf",
          fileblob: "--base64-data--",
          mimetype: "application/pdf"
      },
      {
          filename: "test.txt",
          fileblob: "--base64-data--",
          mimetype: "text/plain"
      }
  ]
}

const res = await mailbox.send(email);
```
