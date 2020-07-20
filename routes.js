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
      req: {},
      res: {
        registered: true
      }
    },
    remove_alias: {
      auth: 'Bearer',
      method: 'delete',
      url: '/mailbox/alias',
      req: {},
      res: {
        removed: true
      }
    }
  }
}