const conf = require('../tests/conf');
const axios = require('axios');
const env = process.env.NODE_ENV;
const path = require('path');

module.exports = (opts) => {
  if (env !== 'test') {

    return new Promise((resolve, reject) => {
      opts = preCallout(reject, opts);

      axios({
        method: opts.route.method,
        url: opts.provider + opts.url,
        data: opts.payload,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': opts.route.auth ? `${opts.route.auth} ${opts.token}` : null
        }
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

    setTimeout(async () => {
      if (opts.route.method === 'get' && opts.route.url === '/mailbox/messages') {
        const hyperdrive = await getDrive();

        const metadata = await hyperdrive.drive.readFile('/meta/encrypted_meta_test.json');

        await hyperdrive.close();

        return resolve(JSON.parse(metadata));
      }

      if (JSON.stringify(opts.payload) !== JSON.stringify(opts.route.req)) {
        if (opts.route.url !== '/mailbox/message') {
          return reject(`Bad request payload for ${opts.route.url}`);
        }
        
        if (opts.route.method === 'post' && opts.route.url === '/mailbox/message') {
          const hyperdrive = await getDrive();
          opts.payload[0]._id = '5f1210b7a29fe6222f199f80';
          await hyperdrive.drive.writeFile('/meta/encrypted_meta_test.json', JSON.stringify(opts.payload));
          await hyperdrive.close();
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
  });
}

function preCallout(reject, opts) {
  const url = opts.route.url;

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

    let arr = url.split('/');
    arr[arr.length - 1] = opts.param;
    opts.url = arr.join('/');
  } else {
    opts.url = opts.route.url;
  }

  return opts;
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
      persist: true
    }
  };

  const hyperdrive = new Hyperdrive(opts);
  const drive = await hyperdrive.connect();

  if (!await hyperdrive.dirExists('/meta')) {
    await drive.mkdir('/meta');
  }

  return hyperdrive;
}