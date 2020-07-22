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
      url: '/mailbox/address/:addr',
      req: null,
      res: { sbpkey: 'd0b573a6f9bd0b676277367d31eda6b931e71f0648d8e0d2d4ca39f896d3dd36' }
    },
    get_new_mail: {
      auth: 'Bearer',
      method: 'get',
      url: '/mailbox/messages',
      req: null,
      res: [{
        _id: '5f1210b7a29fe6222f199f80',
        msg: '1fad354dc805d2fb322bd3bc3993fd4bdbf2d074b81eb3dc3a61ee8f2d1cb7143c2a0d300de5a60749d0025b6536a01657f6997d9561e6b837df7cf2aa2b2c8a38c5a246efc371813e1c5279d4011844076b57240c242908f90c51b07f7b141803c19638466df37590d230d42c1c79fc8d1984373481312414d2de07782d25d4a6dcad26a903118a274499319ea5b7e13c5ff1c6911fcd2e21b0b1ce0f35eaf907cffd5c86994b515a826ea88385ab3f1265ad90fe0d11281e233a045c349a5b4c7e4ae7a804222c209ee19037e84f95bc01607fbcfcf1ef7a35b1cbc323c7f63ae9f59ad394394a491c868b0b0e4479e549c9f7e226ccacd7afafcd1558b6ec60527ceb152cb3339cca50652a88805f7c35'
      }]
    },
    send_encrypted_mail: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/message',
      req: {
        sbpkey: '207a09c53b2c3b9b95c95871a20d3485d3594345dffa8636a7be151ab3821428',
        addr: 'test@telios.io',
        msg: 'eafa21c9ab3d1d9c58db61139670c68ea0e550a52cf230e77d59bf6004323abeb0c5c2701ab73fe8b6a074b9f4fa5c0bf2cbaeee22605adea5fd72f6bb7c425c2a30a1f53873a22b10433ce27da1f26c6bf1f2be6b1854a4e36ff3bfa6a05ef06871bbf5054476c836a6006e126b2cf903514b074136f73634e7383912c734f5339bafb0ae5c39e26174a54b2903f33d9926430940bc72568d258a671613202c6927195736b4d4d61dff64601c00f12ca3bd88e247ebbc00a353d31a2d8a909450b7b3f8c8d763afe537cc3bcb7cac6d91b1185baf09361591960719bed4b92d64c000c9b0d2a44f4afc1a281bb6430379f6e3aa1354601815187581e762b35b164eff9b235cc3fa5a85f5fb0d3bdb24861adbab8139f98c9c7880d2289855c5a4'
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