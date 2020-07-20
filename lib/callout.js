const axios = require('axios');
const env = process.env.NODE_ENV;

module.exports = (opts) => {
  let auth = '';

  if (opts.route.auth === 'Bearer') {
    auth = `${opts.route.auth} ${opts.token}`;
  }

  if (env !== 'test') {
    return new Promise((resolve, reject) => {
      axios({
        method: opts.route.method,
        url: opts.provider + opts.route.path,
        data: opts.payload,
        headers: {
          'Content-Type': 'application/json'
        },
        Authorization: auth
      })
        .then((response) => {
          //handle success
          resolve(response.data);
        })
        .catch(err => {
          //handle error
          let error = new Error();
          error.status = err.response.status;
          error.message = err.response.data.error_msg || err.response.data;
          reject(error);
        });
    });
  } else {
    return simulateCallout(opts)
  }
}

function simulateCallout(opts) {
  return new Promise((resolve, reject) => {
    if (opts.route.auth === 'Bearer' && !opts.token) {
      resolve({ status: 401, data: { message: 'Not Authorized.' } });
    }

    if (opts.provider !== 'https://telios.io') {
      resolve({ status: 400, data: { message: 'Provider must be telios.io' } });
    }

    setTimeout(() => {
      switch (opts.route.url) {
        case '/account/register':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /account/register');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/account/login':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /account/login');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/account/logout':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /account/logout');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/account/key':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /account/key');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/mailbox/register':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /mailbox/register');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/mailbox/alias/register':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /mailbox/alias/register');
          resolve({ status: 200, data: opts.route.res });
          break;
        case '/mailbox/alias':
          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) reject('Bad request payload for /mailbox/alias');
          resolve({ status: 200, data: opts.route.res });
          break;
        default:
          console.log('400 RES ', opts.route.url);
          resolve({ status: 400, message: 'Bad Request' });
      }
    }, 300);
  });
}