const conf = require('./tests/conf');

module.exports = {
  account: {
    register: {
      auth: null,
      method: 'post',
      url: '/account/register',
      req: {
        account: {
          spkey: 'bf04b8d6ebf36a46ae9d55a6d123b7c538e42fe21ac1beeddc5fae3c5ae313bd',
          sbpkey: 'b5e0818615181328fb9e65685ba1029644c8902726495a4d852282d36265087c',
          recovery_email: 'test@telios.io',
          device_id: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
          device_drive: '7a3a58faecd67a5e0387525c31524aab94f22e4c0d0153c8ea1b79f9a10815bd',
          device_core: 'c20ebbfc5702bd4aabf86e055463c011bdcfd24785039c7d70d2be5e6016c7b5'
        },
        sig: '6ae3469c4fda19ae381351f550b891b474ca4118f1901e433d76b3ebdd9566647c2bd54ac59c183affc56ae1e45f9689fddb80d1bafe820a4a8f48612cd81105'
      },
      res: {
        drive: 'cd0979839ee7adc9613ecacfaa1bfad34fb8c76cd23044f5d3b128cd4003fa7e',
        sig: '4b0963a63a0f3aa22e798db7811043503a13a1088ad75759c22ec254353ae36751a191ec4d50c70a661a7d1d382644ff5bd883e203643b1ae42fd26ebf58a501'
      }
    },
    login: {
      auth: null,
      method: 'post',
      url: '/account/login',
      req: {
        account: {
          spkey: 'bf04b8d6ebf36a46ae9d55a6d123b7c538e42fe21ac1beeddc5fae3c5ae313bd',
          sbpkey: 'b5e0818615181328fb9e65685ba1029644c8902726495a4d852282d36265087c',
          device_id: 'b7c38291-8147-4e66-ab33-79c4b8561c70',
          sig: '4b0963a63a0f3aa22e798db7811043503a13a1088ad75759c22ec254353ae36751a191ec4d50c70a661a7d1d382644ff5bd883e203643b1ae42fd26ebf58a501'
        },
        sig: '6ae3469c4fda19ae381351f550b891b474ca4118f1901e433d76b3ebdd9566647c2bd54ac59c183affc56ae1e45f9689fddb80d1bafe820a4a8f48612cd81105'
      },
      res: {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTAyMjAyNCwiaWF0IjoxNTk1MDE4NDI0fQ.PpFP3O1KG-9Y1I4x4ByTswyGASDKRUoCAjxC0tSY6nBkUkwwHTkH8Zt_koK9n-G4j-8OTZvBcp17IosbSR35fqgpsR6X7DSmSkC2W5GGF2QaIt6EuFEWmcByYumXVlC-TZbn02q7vKKxveEnf-_2104vjmsRunWEHAYhHcxJ-yLFjymboF5fvt2wBseCQDSPKpe5dNY6-2XSXu-Yw3JbRtVkTySzoI6hDdUUzjGwQJjOuXrir_qxBLlIw8DlK_BsqDLTe8IjbNxMJKMVjw4BZMxzDqwOy0wIkKbaKfGZWZny-fvcjjT_l0EEFS8vpYc0fpC1aFrHzZcWfmc812h1Ig'
      }
    },
    logout: {
      auth: 'Bearer',
      method: 'post',
      url: '/account/logout',
      req: { devices: 'all' },
      res: {}
    },
    drive: {
      auth: 'Bearer',
      method: 'get',
      url: '/account/key/',
      req: {},
      res: {
        drive: "dd16f33caec40b96644628b19e0c8c4e9ceaf0f58d251167f211396d1d81d61d"
      }
    }
  },
  mailbox: {
    register: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/register',
      req: {
        sbpkey: '4bd1f102176d62a2f9b4598900e35b23e6a136da53590ba96c3e823f8c1d9c7c',
        addr: 'test@telios.io',
        pwd: 'password'
      },
      res: {
        registered: true
      }
    },
    register_alias: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/alias/register',
      req: { addr: 'aliasuser@telios.io' },
      res: {
        registered: true
      }
    },
    remove_alias: {
      auth: 'Bearer',
      method: 'delete',
      url: '/mailbox/alias',
      req: { addr: 'aliasuser@telios.io' },
      res: {
        removed: true
      }
    },
    get_public_key: {
      auth: 'Bearer',
      method: 'get',
      url: '/mailbox/addresses/:addresses',
      req: null,
      res: {
        'alice@telios.io': '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
        'tester@telios.io': '4c709ee7e6d43f1e01d9208c600d466d0c9382e27097ac84249a02b031bad24a'
      }
    },
    get_new_mail: {
      auth: 'Bearer',
      method: 'get',
      url: '/mailbox/messages',
      req: null,
      res: [{
        _id: '5f1210b7a29fe6222f199f80',
        msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
      }]
    },
    send_encrypted_mail: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/message',
      req: {
        sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
        msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
      },
      res: {}
    },
    mark_as_read: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/messages/read',
      req: {
        "msg_ids": ["5f11e4554e19c8223640f0bc"]
      },
      res: {}
    },
  }
}