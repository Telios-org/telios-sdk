module.exports = {
  account: {
    register: {
      auth: null,
      method: 'post',
      url: '/account/register',
      req: {
        account: {
          spkey: 'b4dab9a8e547c0edc1cca396a1bfc735225b1abc424c36e7ab23eec911eb7ee1',
          sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
          recovery_email: 'alice@mail.com',
          device_id: '2fb994f2-6cfa-4d27-a2ff-6108acb23274',
          device_key: 'b399c56db228f8def0a3a170bfef867983f4f629f6b2271ff1bf1012654f7dc3'
        },
        sig: '7b6bff2560ea98756ad60d454ecbbc48b76ade3e9cacb6573afa8af4537b369e37a61d2721af67143bc083ca578c8138b063cb20f357b4669898bc8b45cf4905'
      },
      res: {
        _drive: 'cd0979839ee7adc9613ecacfaa1bfad34fb8c76cd23044f5d3b128cd4003fa7e',
        _sig: '1381a9399dbef59687ef0c39e39567d53a03bfb71c8b62fe9015e0745c60a5bd6fce252f0c738fdaaaff396469ff5acfb97c332ed98f48af866469bd07226104'
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
        _access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzcGtleSI6IjlhZjI2ZTM3MjA3MGY4YjYyNDI5NTJkNWE4NDRiZWUwNzQzZWI3MDRiMTA1ZDY0N2QwYjkzNzBiY2QzMWQxODIiLCJzYnBrZXkiOiJkMGI1NzNhNmY5YmQwYjY3NjI3NzM2N2QzMWVkYTZiOTMxZTcxZjA2NDhkOGUwZDJkNGNhMzlmODk2ZDNkZDM2IiwiZGV2aWNlX2lkIjoiZjcwNTQ0MTVhN2NiMDExZjU1NTI5ODQ0Njc2MjU5MmY5ZTQ4OGI4ZDZkM2FlMGY1YTQ4NDgyNjA3MWFhYmFkZSIsImV4cCI6MTU5NTAyMjAyNCwiaWF0IjoxNTk1MDE4NDI0fQ.PpFP3O1KG-9Y1I4x4ByTswyGASDKRUoCAjxC0tSY6nBkUkwwHTkH8Zt_koK9n-G4j-8OTZvBcp17IosbSR35fqgpsR6X7DSmSkC2W5GGF2QaIt6EuFEWmcByYumXVlC-TZbn02q7vKKxveEnf-_2104vjmsRunWEHAYhHcxJ-yLFjymboF5fvt2wBseCQDSPKpe5dNY6-2XSXu-Yw3JbRtVkTySzoI6hDdUUzjGwQJjOuXrir_qxBLlIw8DlK_BsqDLTe8IjbNxMJKMVjw4BZMxzDqwOy0wIkKbaKfGZWZny-fvcjjT_l0EEFS8vpYc0fpC1aFrHzZcWfmc812h1Ig'
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
      req: { addr: 'alice-netflix@telios.io' },
      res: {
        registered: true
      }
    },
    remove_alias: {
      auth: 'Bearer',
      method: 'delete',
      url: '/mailbox/alias',
      req: { addr: 'alice-netflix@telios.io' },
      res: {
        removed: true
      }
    },
    get_public_key: {
      auth: null,
      method: 'get',
      url: '/mailbox/addresses/:addresses',
      req: null,
      res: [
        {
          address: 'alice@telios.io',
          sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725'
        }
      ]
    },
    get_new_mail: {
      auth: 'Bearer',
      method: 'get',
      url: '/mailbox/messages',
      req: null,
      res: [{
        _id: '5f1210b7a29fe6222f199f80',
        msg: '81eb0873315b7d0ccd8012331080fb1726080a874c7c031fad87046ca68699377dcf761ff3425b02049f3a691a03d02acc90817a9dc190462734f6d7d1b8cab2a08a7f0dbaa967589fcfb3c71182200e846e4743eb910c1f7fc5cb9e731be1b4d4d7296f71e98f8ca044735c5f092e266280f2797b994588c2970bd62c698d9425553d8561c9891d820069657d66ffb38b1e5739e51b52a730c08477b7b3b5e424caf5d17da3560662f001f2ab849f0bf2d0bcbb344bd901f54ab17b9f426ba7427025c7d301446b23206860c3d65129a084dcc43fce5d427bdfda73ef332ae218d640e51fdb268cc7e89217ed544be1305b301b3b52d016f72bcc9ce2eb2391f7f32bccd7aba44c6f736d3272d994fbcae68f61d03912915e3f371fde1e6962845c7ff16e1f771a99307443993cbe8c9c5b1897899655e76080bd1e8b4a599eb3a04964f3f5728678e3eb010abed511ee33add5e41d4e791d452004937d7b82b4a0ecbe32eda96561b59b5bd73eadd11361483ed80219e33d019e3363d954f24246cb7c337f57f1a55bb453f5b41559f5b082721e1510ddcb13da4bf7d85a11cdb7089fccbe8a7810ef9aa6e59216819ceecdecd87b3766673fde41d799adc19c2fd12076fa48a0b4f0366b0287c1212eb386f2fad2c85149c3390c81da77ac6cef625b8b30f47bdf6620c73626ae63bc20076ebcb17b94bebbd21556d2b5178a7eb0167e523746c1c8d441478c83e942de241aed572d3ea0453daf178d17ed810f0daf74c6665c2697d958cce43c2da9f5263d6ce4b36006415f5b196fca2a0ebd852fb5929fe5b370a697286c5aa2471fe6'
      },
      {
        _id: 'f199f805f1210b7a29fe6222',
        msg: 'ca7232f774badb6ef841099e7fef05150987ce3650010b152c93582e0170e54d7634176f24e608b4102ba9a1f0254a563d000fcacf5fc7ff1cb02dd92f665f3cc9121f708d22822b00859b6f5bdb394fb4dd6b8d0e117c9949ab57491f9682811730bd42b73ebc2cc4f1b1a5138a0d9ed8e3130d582e482caeb4ce001d64f68b33efc452c26074bec3209e91cfe6f07a63c58a15e8a58ccdeb7b7f9c21d1c9459785e848c818c973161430b61a4f9d94a33a50fe8ba0a1204a2fe4c38a513a83a8cbae1669bfdec8c252143f55542fe934b25b0b0761fa62fafd0638a9aa4fc892620e032eed336f07e0'
        }
      ]
    },
    send_encrypted_mail: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/message',
      req: [
        {
          sbpkey: '4d2ee610476955dd2faf1d1d309ca70a9707c41ab1c828ad22dbfb115c87b725',
          msg: 'f4e802a9cec3827079a59889abfa6fcbf49d9067809738969ba0060754e7bf33f8571689f9f79be3878a5474f210c2bf47db6378527e782ab8ac5389e9fd49a5dc8e14976dab97668becd036383b7c51fd90790a6c308aa2147a10682cd33afcc1b7cf300c8b0d96120997c59466e56fe4505e72aa1bfcb4d50c28a1d6ac23972e23668bb0897666906009970f24953ea5a2be09e9bbe94e7a434ddb9b26d17b437717ec2bffa0167cac07f40a63527c81eaa39eecca23bc327e8db03645dd82462bb46dc230c54b17bf484dd79ac29f09'
        },
        {
          sbpkey: '4c709ee7e6d43f1e01d9208c600d466d0c9382e27097ac84249a02b031bad24a',
          msg: 'b7b0d35992020a5b6b0bf83fe11afd917f7b038e2e74293f840843cc17fcc92ace56280b883a20028723f061cc4831c055842c279dcf30680acdcf7192c9d414f81ab19a6eac4cadbfb09830c0e7f2db599ec57f51be026e0fbc504b948ea68a1ab37d5c1bd06760e42297596fd5d3961736d74468a03d6f7f47bb7865d1ff45127b6e92db5a2d2d49788855489805b78cdfad421bd82984f00a432547cd58ab34ebff836ae9fbe28f3a32772ee0d8961059866ebcd538ad6e0336e52552d04d288e8bdd3a6957074746fbed23695d7bb3'
        }
      ],
      res: {}
    },
    send_external_mail: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/external/message',
      req: {
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
      },
      res: {}
    },
    mark_as_synced: {
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