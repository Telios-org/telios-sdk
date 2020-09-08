const axios = require('axios');
const routes = require('./routes');

module.exports = async (opts) => {
  const route = routes.account.login;

  return new Promise((resolve, reject) => {
    axios({
      method: route.method,
      url: opts.provider + route.url,
      data: opts.token.authPayload
    })
      .then((response) => {
        resolve(response.data._access_token);
      })
      .catch(err => {
        console.log(err.response.data);
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
    });
}