# Telios Client SDK
[![Build Status](https://travis-ci.org/Telios-org/telios-sdk.svg?branch=master)](https://travis-ci.org/Telios-org/telios-sdk)
[![Current Version](https://img.shields.io/badge/version-0.0.2-green.svg)](https://github.com/Telios-org/telios-sdk)
[![GitHub Issues](https://img.shields.io/github/issues/Telios-org/telios-sdk/open)](https://github.com/Telios-org/telios-sdk/issues)

This SDK can be used to build your own client for communicating with the Telios network. Telios is an offline-capabale e2e encrypted email service that uses p2p technology for sending and receiving emails.

## What does this SDK do?

This SDK provides methods around the Telios Client-Server API. This SDK comes with everything needed for sending/receiving encrypted data, registering a new account, and creating mailboxes and aliases.


## Installation

``` js
npm install telios-sdk
```

## Usage

``` js
const { Account, Mailbox, Hyperdrive, Hypercore } = require('telios-sdk');
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

## API
### Account
The Account object handles communication with the Telios server and provides methods for creating request payloads.

#### Create Keypairs
-----
Keypairs will need to be initially created before any other actions can be taken. These keys will be used for encrypting/decrypting data on the client. The private keys should be stored somewhere safe (and encrypted) and never shared. The public keys generated will be used for encrypting a recipient's data and can be shared publicly.

``` js
const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const secret_box_pub_key = secretBoxKeypair.publicKey;
const secret_box_priv_key = secretBoxKeypair.privateKey;

const signing_pub_key = signingKeypair.publicKey;
const signing_priv_key = signingKeypair.privateKey;
```
#### Register
-----
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

Example response:
> **NOTE**: The `sig` returned will be required for authentication and should be stored and encrypted locally. This essentially replaces the need for requiring a username and password for authentication.
```js
{
  drive: 'cd0979839ee7adc9613ecacfaa1bfad34fb8c76cd23044f5d3b128cd4003fa7e', // The seed drive
  sig: '4b0963a63a0f3aa22e798db7811043503a13a1088ad75759c22ec254353ae36751a191ec4d50c70a661a7d1d382644ff5bd883e203643b1ae42fd26ebf58a501'
}
```

#### Login
-----
```js
// Instantiate a new Account object
const account = new Account({
  provider: 'telios.io'
});

// Create an account payload and then sign with your public signing key
const account = {
  spkey: 'ef984b756a51e67ad49f653c90e826468bc931cd3ccf50aebec2fa1d549d864d',
  sbpkey: '4bd1f102176d62a2f9b4598900e35b23e6a136da53590ba96c3e823f8c1d9c7c',
  device_id: 'b1926811-860a-423c-ba13-b905d9dc5998',
  sig: 'abf20e4d0487427e4078df4459f16d9aed18e417e592a950badbe1d1e4038dc629c3b2de62062ea2c687046b2e0a207ff5c3630e07695a8892f0de5d12b46600'
};

// Sign account
const auth_payload = Account.accountSignAuth(account);

// Authenticate with auth payload
const res = await account.register(auth_payload);
```

Example response:
> **NOTE**: The `access_token` returned will be required for all protected routes and should be stored and encrypted locally.

```js
{
    "access_token": <jwt_token>
}
```
