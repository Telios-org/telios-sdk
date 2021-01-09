module.exports = (auth) => {
  const Account = require('./account');

  if (auth) {
    const claims = {
      device_signing_key: auth.device_signing_key,
      sbpkey: auth.sbpkey,
      peer_key: auth.peer_key,
      device_id: auth.device_id,
      sig: auth.sig
    };

    return Account.createAuthToken(claims, auth.device_signing_priv_key);
  }

  return null;
}