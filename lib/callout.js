const axios = require('axios');
const moment = require('moment');
const env = process.env.NODE_ENV;
const path = require('path');
const jwt_decode = require('jwt-decode');
const refreshToken = require('./refreshToken');

module.exports = (opts) => {
  if (env !== 'test') {
    return new Promise(async (resolve, reject) => {
      try {
        preCallout(opts).then((opts) => {
          const token = opts.token && opts.token.value ? opts.token.value : null;

          axios({
            method: opts.route.method,
            url: opts.provider + opts.url,
            data: opts.payload,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': opts.route.auth ? `${opts.route.auth} ${token}` : null
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
  let token = opts.token && opts.token.value ? opts.token.value : null;
  const url = opts.route.url;
  
  try {
    if (token) {
      if (tokenExpired(token) && opts.token.authPayload) {
        opts.token.value = await refreshToken(opts);
        opts.event.emit('tokenRefreshed', opts.token.value);
      }
    }
    
    if (opts.route.auth === 'Bearer' && !token) {
      throw 'JWT token is required';
    }

    if (opts.route.auth === 'Bearer') {
      opts.auth = `${opts.route.auth} ${token}`;
    }

    if (opts.provider.indexOf('telios.io') === -1) {
      throw 'Provider domain must be telios.io';
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

function tokenExpired(token) {
  if (token) {
    const decoded = jwt_decode(token);
    const exp = moment.unix(decoded.exp).utc();
    return moment.utc().isAfter(exp);
  }
}

async function getDrive() {
  const SDK = require('dat-sdk');
  const sdk = await SDK({
    storage: path.join(__dirname, '../tests/storage')
  });
  const { Hyperdrive } = require('../');

  const opts = {
    name: 'META',
    sdk: sdk,
    driveOpts: {
      persist: false
    }
  };

  const hyperdrive = new Hyperdrive(opts);
  const drive = await hyperdrive.connect();

  if (!await hyperdrive.dirExists('/meta')) {
    await drive.mkdir('/meta');
  }

  return { hyperdrive, sdk };
}