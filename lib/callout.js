const axios = require('axios');
const env = process.env.NODE_ENV;
const path = require('path');
const refreshToken = require('./refreshToken');

module.exports = (opts) => {
  if (env !== 'test') {
    return new Promise(async (resolve, reject) => {
      try {
        preCallout(opts).then((opts) => {
          axios({
            method: opts.route.method,
            url: opts.provider + opts.url,
            data: opts.payload,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': opts.route.auth ? `${opts.auth}` : null
            }
          })
            .then((response) => {
              //handle success
              resolve(response.data);
            })
            .catch(err => {
              //handle error
              let error = new Error();
              if (!err.response) {
                error.status = null;
                error.message = 'Could not connect to the server.';
                reject(error);
              } else {
                error.status = err.response.status;
                error.message = err.response.data.error_msg || err.res;
                reject(error);
              }
            });
        }).catch((err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return simulateCallout(opts)
  }
}

function simulateCallout(opts) {
  const fs = require('fs');
  return new Promise(async (resolve, reject) => {
    try {
      preCallout(opts).then((opts) => {
        setTimeout(async () => {
          if (opts.route.method === 'get' && opts.route.url === '/mailbox/messages') {
            const metadata = fs.readFileSync(path.join(__dirname, '../tests/data/meta/encrypted_meta_test.json'));
            return resolve(JSON.parse(metadata.toString()));
          }

          if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) {
            if (opts.route.url !== '/mailbox/message') {
              return reject(`Bad request payload for ${opts.route.url}`);
            }

            if (opts.route.method === 'post' && opts.route.url === '/mailbox/message') {
              const filePath = path.join(__dirname, '../tests/data/meta/encrypted_meta_test.json');
              opts.payload[0]._id = '5f1210b7a29fe6222f199f80';
              fs.writeFileSync(filePath, JSON.stringify(opts.payload));
            }

            if (
              !Array.isArray(opts.payload) ||
              !opts.payload[0].hasOwnProperty('sbpkey') ||
              !opts.payload[0].hasOwnProperty('msg')
            ) {
              reject(`Bad request payload for ${opts.route.url}`);
            }
          }
          resolve(opts.route.res);
        }, 50);
      }).catch((err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function preCallout(opts) {
  let error = null;
  const url = opts.route.url;
  const token = refreshToken(opts.auth);
  
  try {   
    if (opts.route.auth === 'Bearer' && !token) {
      throw 'Auth token is required';
    }

    if (opts.route.auth === 'Bearer') {
      opts.auth = `${opts.route.auth} ${token}`;
    }

    if (opts.route.method === 'get' && opts.route.url.indexOf(':') > 0) {
      if (Array.isArray(opts.param)) {
        opts.param = opts.param.toString();
      }

      let arr = url.split('/');
      arr[arr.length - 1] = opts.param;
      opts.url = arr.join('/');
    } else {
      opts.url = opts.route.url;
    }
  } catch (err) {
    error = err;
  }
  
  return new Promise((resolve, reject) => {
    if (error) return reject(error);
    resolve(opts);
  });
}