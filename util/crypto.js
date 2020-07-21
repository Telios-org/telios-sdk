const sodium = require('sodium-native');

exports.verifySig = (sig, publicKey, msg) => {
  let m = Buffer.from(JSON.stringify(msg));
  let signature = Buffer.alloc(sodium.crypto_sign_BYTES);
  let pk = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);

  pk.fill(Buffer.from(publicKey, 'hex'));
  signature.fill(Buffer.from(sig, 'hex'));

  return sodium.crypto_sign_verify_detached(signature, m, pk);
};

exports.generateSigKeypair = () => {
  let pk = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
  let sk = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

  sodium.crypto_sign_keypair(pk, sk);

  return {
    publicKey: pk.toString('hex'),
    privateKey: sk.toString('hex')
  }
}

exports.generateSBKeypair = () => {
  let pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  let sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

  sodium.crypto_box_keypair(pk, sk);

  return {
    publicKey: pk.toString('hex'),
    privateKey: sk.toString('hex')
  }
}

exports.encryptMessage = (msg, sbpkey, privKey) => {
  const m = Buffer.from(msg, 'utf-8');
  const c = Buffer.alloc(m.length + sodium.crypto_box_MACBYTES);
  const n = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
  const pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

  pk.fill(Buffer.from(sbpkey, 'hex'));
  sk.fill(Buffer.from(privKey, 'hex'));

  sodium.crypto_box_easy(c, m, n, pk, sk);

  return c.toString('hex');
}

exports.decryptMessage = (msg, sbpkey, privKey) => {
  const c = Buffer.from(msg, 'hex');
  const m = Buffer.alloc(c.length - sodium.crypto_box_MACBYTES);
  const n = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
  const pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

  pk.fill(Buffer.from(sbpkey, 'hex'));
  sk.fill(Buffer.from(privKey, 'hex'));

  const bool = sodium.crypto_box_open_easy(m, c, n, pk, sk);

  if (!bool) throw new Error('Unable to decrypt message.');

  return m.toString('utf-8');
}

exports.signDetached = (msg, privKey) => {
  let sig = Buffer.alloc(sodium.crypto_sign_BYTES);
  let m = Buffer.from(JSON.stringify(msg));
  let sk = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

  sk.fill(Buffer.from(privKey, 'hex'));

  sodium.crypto_sign_detached(sig, m, sk);

  const signature = sig.toString('hex');

  return signature;
};

exports.hash = str => {
  let out = Buffer.alloc(sodium.crypto_generichash_BYTES);
  let txt = Buffer.from(str);

  sodium.crypto_generichash(out, txt);

  return out.toString('hex');
};

exports.hashPassword = str => {
  let out = Buffer.alloc(sodium.crypto_pwhash_STRBYTES);
  let passwd = Buffer.from(str, 'utf-8');
  let opslimit = sodium.crypto_pwhash_OPSLIMIT_MODERATE;
  let memlimit = sodium.crypto_pwhash_MEMLIMIT_MODERATE;

  sodium.crypto_pwhash_str(out, passwd, opslimit, memlimit);

  return out;
};

exports.generateMasterKey = () => {
  let key = Buffer.alloc(sodium.crypto_kdf_KEYBYTES);
  sodium.crypto_kdf_keygen(key);
  return key;
};

exports.deriveKeyFromMaster = (masterKey, skId) => {
  let subkey = Buffer.alloc(sodium.crypto_kdf_BYTES_MAX);
  let subkeyId = skId;
  let ctx = Buffer.alloc(sodium.crypto_kdf_CONTEXTBYTES);
  let key = Buffer.from(masterKey, 'hex');

  sodium.crypto_kdf_derive_from_key(subkey, subkeyId, ctx, key);

  return subkey;
};

exports.randomBytes = data => {
  let buf = Buffer.alloc(sodium.randombytes_SEEDBYTES);
  let seed = Buffer.from(data, 'utf-8');

  sodium.randombytes_buf_deterministic(buf, seed);

  return buf.toString('hex');
};

exports.generateStreamKey = () => {
  let k = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES);
  sodium.crypto_secretstream_xchacha20poly1305_keygen(k);
  return k;
}

exports.initStreamPushState = (k) => {
  let state = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES);
  let header = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES);
  sodium.crypto_secretstream_xchacha20poly1305_init_push(state, header, k);

  return { state: state, header: header };
}

exports.secretStreamPush = (chunk, state) => {
  let c = Buffer.alloc(chunk.length + sodium.crypto_secretstream_xchacha20poly1305_ABYTES);
  let tag = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_TAGBYTES);
  
  sodium.crypto_secretstream_xchacha20poly1305_push(state, c, chunk, null, tag);

  return c;
}

exports.initStreamPullState = (header, k) => {
  let state = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES);
  sodium.crypto_secretstream_xchacha20poly1305_init_pull(state, header, k);
  return state;
}

exports.secretStreamPull = (chunk, state) => {
  let m = Buffer.alloc(chunk.length - sodium.crypto_secretstream_xchacha20poly1305_ABYTES);
  let tag = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_TAGBYTES);

  sodium.crypto_secretstream_xchacha20poly1305_pull(state, m, tag, chunk, null);

  return m;
}
