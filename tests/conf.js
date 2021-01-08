module.exports = {
  ALICE_SB_PUB_KEY: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
  ALICE_SB_PRIV_KEY: '04968601b00541a9a2188b1709b4c11534ad419fd4d8143a67b3622bf924e5ee',
  ALICE_SIG_PUB_KEY: '87f599ab6a339022336314e499979fb80fb872bbeacb261a714892ac16717162',
  ALICE_SIG_PRIV_KEY: '6a956879bbcfb1bf389baea1682768366cd8058fc53771648c2172b62e11ce9287f599ab6a339022336314e499979fb80fb872bbeacb261a714892ac16717162',
  ALICE_PEER_PUB_KEY: '4288afe913c47a91d7e8e6252d20a8a37d11e4bef58f41cbe3425c4a3502b207',
  ALICE_PEER_SECRET_KEY: '6b98a2122ac0c2778dd9e07ed38a631b4539636894cd856c790b257f4d75fb07',
  ALICE_RECOVERY: 'alice@mail.com',
  ALICE_MAILBOX: 'alice@telios.io',
  ALICE_ACCOUNT_SIG: '2062f414199cbbbd1043c64c0400272b184b119d69e5447294e344e4470c2274dad60a7d6aab8ef013520d4d361325cba1d3572e64ca38cf5c81ddb1791cbd06',
  ALICE_ACCOUNT_SERVER_SIG: 'eb0e6b929ad1e45d53a928d41ecab12c540c8d78c23c64a4dd00a35cea979b42f9068a28b76e486fcc6d0ea7f613f60a97f859baa42bcbd1e49ab5c9025d2b0e',
  ALICE_DEVICE_1_ID: '3410ce90-8e8d-4985-827a-2a9b65931b69',
  ALICE_DEVICE_1_CORE_NAME: 'Alice',
  ALICE_DEVICE_1_KEY: 'b399c56db228f8def0a3a170bfef867983f4f629f6b2271ff1bf1012654f7dc3',
  BOB_SB_PUB_KEY: '4c709ee7e6d43f1e01d9208c600d466d0c9382e27097ac84249a02b031bad13c',
  BOB_SB_PRIV_KEY: 'a57c37a06e5b43da677ddbf37654aa8525da91f977aa6dde1cd0ee7f6b081158',
  BOB_SIG_PUB_KEY: '9e26ea0f73fdea02b708f2bb836f830372328ef256f51b4bb3b7eb0a42186451',
  BOB_SIG_PRIV_KEY: 'cc3e6e8ccd987555af8a63916e7ac9a372578085bec4659588f28a6a3bb2767d9e26ea0f73fdea02b708f2bb836f830372328ef256f51b4bb3b7eb0a42186451',
  MAILSERVER_DRIVE: 'Test Drive',
  MAILSERVER_CORE: 'Test Core',
  MAILSERVER_DRIVE_PATH: '/alice@telios.io',
  MAILSERVER_DRIVE_PATH2: '/alice@telios.io/a5caa6dd-835f-4468-a54c-a42c6225778d',
  CORE_NAME: 'Test Core',
  DRIVE_OPTS: {
    driveOpts: {
      persist: false
    }
  },
  CORE_OPTS: {
    coreOpts: {
      persist: false
    }
  },
  TEST_EMAIL_ENCRYPTED_META: 'f29828da9eb336b67f46b2efd3d9d05b0987ce3650010b15289708270221b44d2432146f79e30cb81424fba0f37410573e00009bca0dc2af1db079de7467583d954610278d22827c02d39a6a5186381db3d8628a0d4121c349ab57510f95c4de4723e501b16dec7193f0ecf517dc0a9c8bb2140f0f751976afe99c521a3bf18f3cbfc902c43074bf9671c29c90bca32f64829e54aefbc7dffc3033db578e9865d2b2ee01fa0f822951467de0020cd3deae611eb889a988374a03f9c995163c9fa9c3f45a69eb8bcdc74948684d0a31e866a95712506ce360e2ab5026ada94c9a906804017af876',
  TEST_EMAIL: {
    to: [{
      name: "Alice Tester",
      address: "alice@telios.io"
    }],
    from: [{
      name: "Bob Tester",
      address: "bob@telios.io"
    }],
    subject: "Hello Alice",
    text_body: "You're my favorite test person ever",
    html_body: "<h1>You're my favorite test person ever</h1>",
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
}