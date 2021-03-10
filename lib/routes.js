module.exports = {
  account: {
    register: {
      auth: null,
      method: 'post',
      url: '/account/register',
      req: {
        account: {
          device_signing_key: '',
          account_key: '',
          peer_key: '',
          recovery_email: 'alice@mail.com',
          device_id: '00000000-0000-0000-000000000000'
        },
        sig: ''
      },
      res: {
        _sig: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      }
    },
    login: {
      auth: null,
      method: 'post',
      url: '/account/login',
      req: {
        account: {
          spkey: '',
          account_key: '',
          device_id: '00000000-0000-0000-000000000000',
          sig: ''
        },
        sig: ''
      },
      res: {
        _access_token: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
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
        drive: "0000000000000000000000000000000000000000000000000000000000000000"
      }
    }
  },
  mailbox: {
    register: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/register',
      req: {
        account_key: '',
        name: 'Alice Tester',
        addr: 'test@telios.io'
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
          account_key: '8922001759cda2b4d2a2cc6890c7ae4ed7b71f3a645c74b77ec89365985af236'
        }
      ]
    },
    get_new_mail: {
      auth: 'Bearer',
      method: 'get',
      url: '/mailbox/messages',
      req: null,
      res: [{
        _id: '111111111111111111111111',
        msg: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      },
      {
        _id: '222222222222222222222222',
        msg: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        }
      ]
    },
    send_encrypted_mail: {
      auth: 'Bearer',
      method: 'post',
      url: '/mailbox/message',
      req: [
        {
          account_key: '',
          msg: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        },
        {
          account_key: '0000000000000000000000000000000000000000000000000000000000000000',
          msg: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
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
        "msg_ids": ["000000000000000000000000"]
      },
      res: {}
    },
  }
}