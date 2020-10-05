module.exports = {
  ALICE_SB_PUB_KEY: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
  ALICE_SB_PRIV_KEY: '04968601b00541a9a2188b1709b4c11534ad419fd4d8143a67b3622bf924e5ee',
  ALICE_SIG_PUB_KEY: 'b4dab9a8e547c0edc1cca396a1bfc735225b1abc424c36e7ab23eec911eb7ee1',
  ALICE_SIG_PRIV_KEY: 'fef512de6aa5931da1b9cd099c3f867e49625c729a4cbc5e4a67e97c9fdc0737b4dab9a8e547c0edc1cca396a1bfc735225b1abc424c36e7ab23eec911eb7ee1',
  ALICE_RECOVERY: 'alice@mail.com',
  ALICE_MAILBOX: 'alice@telios.io',
  ALICE_ACCOUNT_SIG: '7b6bff2560ea98756ad60d454ecbbc48b76ade3e9cacb6573afa8af4537b369e37a61d2721af67143bc083ca578c8138b063cb20f357b4669898bc8b45cf4905',
  ALICE_ACCOUNT_SERVER_SIG: '1381a9399dbef59687ef0c39e39567d53a03bfb71c8b62fe9015e0745c60a5bd6fce252f0c738fdaaaff396469ff5acfb97c332ed98f48af866469bd07226104',
  ALICE_DEVICE_1_ID: '2fb994f2-6cfa-4d27-a2ff-6108acb23274',
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