const sodium = require('sodium-native');
const stream = require('stream');
const pump = require('pump');

exports.verifySig = (sig, publicKey, msg) => {
  let m = Buffer.from(JSON.stringify(msg));
  let signature = Buffer.alloc(sodium.crypto_sign_BYTES);
  let pk = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);

  pk.fill(Buffer.from(publicKey, 'hex'));
  signature.fill(Buffer.from(sig, 'hex'));

  return sodium.crypto_sign_verify_detached(signature, m, pk);
};

exports.signSeedKeypair = (seed) => {
  let pk = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
  let sk = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

  if (!seed) {
    seed = Buffer.alloc(sodium.crypto_sign_SEEDBYTES);
    sodium.randombytes_buf(seed);
  } else {
    seed = Buffer.from(seed, 'hex');
  }

  sodium.crypto_sign_seed_keypair(pk, sk, seed);
  
  return {
    publicKey: pk.toString('hex'),
    privateKey: sk.toString('hex'),
    seedKey: seed.toString('hex')
  }
}

exports.boxSeedKeypair = (seed) => {
  let pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  let sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

  if (!seed) {
    seed = Buffer.alloc(sodium.crypto_box_SEEDBYTES);
    sodium.randombytes_buf(seed);
  } else {
    seed = Buffer.from(seed, 'hex');
  }

  sodium.crypto_box_seed_keypair(pk, sk, seed);

  return {
    publicKey: pk.toString('hex'),
    privateKey: sk.toString('hex'),
    seedKey: seed.toString('hex')
  }
}

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

exports.encryptSBMessage = (msg, sbpkey, privKey) => {
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

exports.decryptSBMessage = (msg, sbpkey, privKey) => {
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

exports.encryptSealedBox = (msg, pubKey) => {
  let m = Buffer.from(msg, 'utf-8');
  let c = Buffer.alloc(m.length + sodium.crypto_box_SEALBYTES);
  let pk = Buffer.from(pubKey, 'hex');

  sodium.crypto_box_seal(c, m, pk);

  return c;
}

exports.decryptSealedBox = (msg, privKey, pubKey) => {
  let c = Buffer.from(msg, 'hex');
  let m = Buffer.alloc(c.length - sodium.crypto_box_SEALBYTES);
  let sk = Buffer.from(privKey, 'hex');
  let pk = Buffer.from(pubKey, 'hex');

  var bool = sodium.crypto_box_seal_open(m, c, pk, sk);

  if (!bool) throw new Error('Unable to decrypt message.');

  return m.toString('utf-8');
}

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

exports.generateAEDKey = () => {
  let k = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  sodium.crypto_aead_xchacha20poly1305_ietf_keygen(k);
  return k;
}

exports.encryptAED = (key, msg) => {
  let m = Buffer.from(msg, 'utf-8');
  let c = Buffer.alloc(m.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES);
  let npub = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  let k = Buffer.from(key, 'hex');
  
  sodium.randombytes_buf(npub);
  
  sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(c, m, null, null, npub, k);

  return { npub: npub, encrypted: c };
}

exports.decryptAED = (key, nonce, c) => {
  let m = Buffer.alloc(c.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES);
  let npub = Buffer.from(nonce, 'hex');
  let k = Buffer.from(key, 'hex');

  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(m, null, c, null, npub, k);

  return m;
}

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

exports.encryptStream = async (readStream, writeStream) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  let bytes = '';

  const key = _generateStreamKey();
  let { state, header } = _initStreamPushState(key);

  return new Promise((resolve, reject) => {
    const encrypt = _encrypt(header, state);

    pump(readStream, encrypt, writeStream, (err) => {
      if(err) return reject(err);

      const file = {
        hash: hash.digest('hex'),
        size: bytes
      }

      resolve({ key, header, file });
    })
  });

  function _encrypt(header, state) {
    let size = 0;
    let message = Buffer.from([]);

    return new stream.Transform({
      transform
    });
  

    function transform(chunk, encoding, callback) {
      if(size === 0) {
        bytes += chunk.toString().length;
        hash.update(chunk);
        const buf = _secretStreamPush(chunk, state);
        const totalLen = buf.length + header.length;
        message = Buffer.concat([header, buf], totalLen);
        size += 1;
      } else {
        message = _secretStreamPush(chunk, state);
      }

      callback(null, message);
    }
  }

  function _generateStreamKey() {
    let k = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES);
    sodium.crypto_secretstream_xchacha20poly1305_keygen(k);
    return k;
  }

  function _initStreamPushState(k) {
    let state = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES);
    let header = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES);
    sodium.crypto_secretstream_xchacha20poly1305_init_push(state, header, k);

    return { state: state, header: header };
  }

  function _secretStreamPush(chunk, state) {
    let c = Buffer.alloc(chunk.length + sodium.crypto_secretstream_xchacha20poly1305_ABYTES);
    let tag = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_TAGBYTES);
    
    sodium.crypto_secretstream_xchacha20poly1305_push(state, c, chunk, null, tag);

    return c;
  }
}

exports.decryptStream = (readStream, opts) => {
  let key = opts.key;
  let header = opts.header;

  if(!Buffer.isBuffer(key) && typeof key === 'string') {
    key = Buffer.from(key, 'hex');
  }

  if(!Buffer.isBuffer(header) && typeof header === 'string') {
    header = Buffer.from(header, 'hex');
  }

  const decrypt = _decrypt(key, header, { start: opts.start });

  pump(readStream, decrypt, (err) => {
    if(err) return t.error(err);
  });
  
  return decrypt;

  function _decrypt(k, h, opts) {
    let toSkip = opts.start ? opts.start : 0;
    let message = Buffer.from([]);
    let state = _initStreamPullState(h, k);

    return new stream.Transform({
      writableObjectMode: true,
      transform
    });

    function transform(chunk, encoding, callback) {
      if (toSkip == 0) {
        message = _secretStreamPull(chunk, state);
      } else if (toSkip > chunk.length) {
        toSkip -= chunk.length;
      } else {
        if (toSkip !== chunk.length) {
          message = _secretStreamPull(chunk.slice(toSkip), state);
        }
        toSkip = 0;
      }

      callback(null, message);
    }
  }

  function _initStreamPullState(header, k) {
    let state = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES);
    sodium.crypto_secretstream_xchacha20poly1305_init_pull(state, header, k);
    return state;
  }

  function _secretStreamPull(chunk, state) {
    let m = Buffer.alloc(chunk.length - sodium.crypto_secretstream_xchacha20poly1305_ABYTES);
    let tag = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_TAGBYTES);

    sodium.crypto_secretstream_xchacha20poly1305_pull(state, m, tag, chunk, null);

    return m;
  }
}