module.exports = {
  ALICE_SB_PUB_KEY: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
  ALICE_SB_PRIV_KEY: '04968601b00541a9a2188b1709b4c11534ad419fd4d8143a67b3622bf924e5ee',
  ALICE_SIG_PUB_KEY: 'f2f46af24599cdec76f8bee74efcbe4fc7d541a1af67efa404fa8794ef497b08',
  ALICE_SIG_PRIV_KEY: 'f7ec003c0ed0442b9dea628ddf1b4fa4da09f929c2a06eccdb03b23d7dc635cef2f46af24599cdec76f8bee74efcbe4fc7d541a1af67efa404fa8794ef497b08',
  ALICE_RECOVERY: 'alice@mail.com',
  ALICE_MAILBOX: 'alice@telios.io',
  ALICE_DEVICE_1_ID: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
  ALICE_DEVICE_1_DRIVE: '',
  BOB_SB_PUB_KEY: '4c709ee7e6d43f1e01d9208c600d466d0c9382e27097ac84249a02b031bad13c',
  BOB_SB_PRIV_KEY: 'a57c37a06e5b43da677ddbf37654aa8525da91f977aa6dde1cd0ee7f6b081158',
  BOB_SIG_PUB_KEY: '9e26ea0f73fdea02b708f2bb836f830372328ef256f51b4bb3b7eb0a42186451',
  BOB_SIG_PRIV_KEY: 'cc3e6e8ccd987555af8a63916e7ac9a372578085bec4659588f28a6a3bb2767d9e26ea0f73fdea02b708f2bb836f830372328ef256f51b4bb3b7eb0a42186451',
  ALICE_DEVICE_1_ID: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
  ALICE_DEVICE_1_DRIVE: '',
  MAILSERVER_DRIVE: 'Test Drive',
  MAILSERVER_DRIVE_PATH: '/alice@telios.io/a5caa6dd-835f-4468-a54c-b53e7114887c',
  CORE_NAME: 'Test Core',
  TEST_EMAIL_ENCRYPTED_META: 'f29828da9eb336b67f46b2efd3d9d05b0987ce3650010b15289708270221b44d2432146f79e30cb81424fba0f37410573e00009bca0dc2af1db079de7467583d954610278d22827c02d39a6a5186381db3d8628a0d4121c349ab57510f95c4de4723e501b16dec7193f0ecf517dc0a9c8bb2140f0f751976afe99c521a3bf18f3cbfc902c43074bf9671c29c90bca32f64829e54aefbc7dffc3033db578e9865d2b2ee01fa0f822951467de0020cd3deae611eb889a988374a03f9c995163c9fa9c3f45a69eb8bcdc74948684d0a31e866a95712506ce360e2ab5026ada94c9a906804017af876',
  TEST_EMAIL: {
    to: ["Alice Tester <alice@telios.io>", "Test Tester <tester@telios.io>"],
    sender: "Bob Tester <bob@telios.io>",
    subject: "Hello Alice",
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
}