const axios = require('axios');
const env = process.env.NODE_ENV;

module.exports = (opts) => {
  if (env !== 'test') {
    let auth = '';

    return new Promise((resolve, reject) => {
      opts = preCallout(reject, opts);

      if (opts.route.auth) {
        auth = `Bearer ${opts.token}`  
      }

      axios({
        method: opts.route.method,
        url: opts.provider + opts.route.url,
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
    opts = preCallout(reject, opts);

    setTimeout(() => {
      if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) {
        if (opts.route.url !== '/mailbox/message') {
          return reject(`Bad request payload for ${opts.route.url}`);
        } else {
          if (
            !Array.isArray(opts.payload) ||
            !opts.payload[0].hasOwnProperty('sbpkey') ||
            !opts.payload[0].hasOwnProperty('msg')
          ) {
            reject(`Bad request payload for ${opts.route.url}`);
          }
        }
        
      } 
      resolve({ status: 200, url: opts.route.url, data: opts.route.res });
    }, 50);
  });
}

function preCallout(reject, opts) {
  if (opts.route.auth === 'Bearer' && !opts.token) {
    reject('JWT token is required');
  }

  if (opts.route.auth === 'Bearer') {
    opts.auth = `${opts.route.auth} ${opts.token}`;
  }

  if (opts.provider !== 'https://telios.io') {
    reject('Provider must be telios.io');
  }

  if (opts.route.method === 'get' && opts.route.url.indexOf(':') > 0) {

    if (Array.isArray(opts.param)) {
      opts.param = opts.param.toString();
    }

    let arr = opts.route.url.split('/');
    arr[arr.length - 1] = opts.param;
    opts.route.url = arr.join('/');
  }

  return opts;
}