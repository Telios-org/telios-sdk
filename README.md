# Telios Client SDK
[![Build Status](https://travis-ci.org/Telios-org/telios-sdk.svg?branch=master)](https://travis-ci.org/Telios-org/telios-sdk)
[![Current Version](https://img.shields.io/github/package-json/v/Telios-org/telios-sdk)](https://github.com/Telios-org/telios-sdk)
[![GitHub Issues](https://img.shields.io/github/issues/Telios-org/telios-sdk/open)](https://github.com/Telios-org/telios-sdk/issues)

This package provides components for building an email client using the Telios Network. Telios is an offline-capabale e2e encrypted email service that uses p2p technology for sending and receiving emails.

## What does this SDK do?

This SDK provides methods for interacting with the Telios Client-Server API. It comes with everything needed for sending/receiving encrypted data, registering a new account, creating mailboxes, and registering aliases.


## Installation

``` js
npm i @telios/telios-sdk
```

## Usage

``` js
const { Account, Mailbox } = require('@telios/telios-sdk');
const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const account = new Account({
  provider: 'telios.io'
});

const payload = await Account.init({
  spkey: signingKeypair.publicKey,
  sbpkey: secretBoxKeypair.publicKey,
  recovery_email: 'user@mail.com'
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
After a successful registration, the server will create a seed `drive` and return this to the client. This `drive` will seed the user's data when all devices are disconnected. This is required in situations where a client attempts to retrieve an email from an offline device.

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
  _drive: '[drive_key]', // The seed drive's public key created by the server
  _sig: '[server_signature]' // signature from server to be used for authentication
}
```
The `sig` returned will be required for authentication and should be stored and encrypted locally. This replaces the need for requiring a username and password for authentication.

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
  sig: '[server_signature]'
};

// Construct auth request
const auth_payload = Account.accountSignAuth(account);

// Authenticate with auth payload
const res = await account.register(auth_payload);
```

#### Example response:

```js
{
  "_access_token": '[jwt_token]'
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

### Register a New Alias
`registerAlias` only requires the full alias address passed in as a string. All mail sent to this address will automatically forward to the main mailbox.

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
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
  provider: 'telios.io',
  token: '[jwt_token]'
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
  provider: 'telios.io',
  token: '[jwt_token]'
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
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

/**
 * In this example Bob is sending an ecrypted email to two other Telios mailboxes.
*/

/**
 * Private key is only used during encryption and never sent or stored.
 */
const privKey = '[bob_secret_box_private_key]'; 

/**
 * Public key is used for authenticity of sender
 */
const pubKey = '[bob_secret_box_public_key]';

const email = {
  to: ["Alice Tester <alice@telios.io>", "Test Tester <tester@telios.io>"],
  sender: "Bob Tester <bob@telios.io>",
  subject: "Hello Alice",
  text_body: "You're my favorite test person ever",
  html_body: "<h1>You're my favorite test person ever</h1>",
  custom_headers: [
    {
      header: "Reply-To",
      value: "Actual Person <test@telios.io>"
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

const res = await mailbox.send(email, {
  /**
   * The sender's private key (Bob)
   */
  privKey: privKey,

  /**
   * The sender's public key (Bob)
   */
  pubKey: pubKey,

  /**
   * The key for the local drive that will be storing the ecrypted email
   */
  drive: '[drive_key]',

  /**
   * This is the path on the local drive where the encrypted email data will be written. 
   * In the example below, the sender (Bob) stores all sent mail in a directory with the 
   * name of his mailbox (/bob@telios.io), and all encrypted emails are stored inside this directory. 
   * Each are named with a generated guid (a5caa6dd-835f-4468-a54c-b53e7114887c) for added privacy. 
   * When the other recipients decode their metadata sent to them via Bob, they will use this 
   * path to retrieve their email.
   *  
   * example: '/bob@telios.io/a5caa6dd-835f-4468-a54c-b53e7114887c'
  */
  drivePath: '[path_to_encrypted_email]'
});

```

### Retrieve New Emails

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

const sbpkey = conf.ALICE_SB_PUB_KEY;
const privKey = conf.ALICE_SB_PRIV_KEY;

const mail = await mailbox.getNewMail(privKey, sbpkey);
```

#### Example response:

```js
[
  {
    _id: '5f1210b7a29fe6222f199f80',
    msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
  }
]
```

### Mark Emails as Read

``` js
const mailbox = new Mailbox({
  provider: 'telios.io',
  token: '[jwt_token]'
});

/**
 * Pass in an array of message IDs to be marked as read
 */
const res = await mailbox.markAsRead(["5f1210b7a29fe6222f199f80"]);
```

#### Example response:

```js
[
  {
    _id: '5f1210b7a29fe6222f199f80',
    msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
  }
]
```
