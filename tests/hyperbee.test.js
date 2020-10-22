const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Crypto, Hypercore, Hyperbee } = require('..');
const SDK = require('dat-sdk');
const ram = require('random-access-memory');

let hyperbee = null;
const keypair = Crypto.generateSBKeypair();

test('Hyperbee - Create new db', async t => {
  t.plan(1);

  try {
    const sdk = await SDK({ storage: ram });

    const opts = {
      name: 'Test DB Core',
      sdk: sdk,
      coreOpts: {
        persist: false
      }
    };

    const hypercore = new Hypercore(opts);
    await hypercore.connect();
    const feed = hypercore.feed;
    
    hyperbee = new Hyperbee(feed, null);

    t.ok(hyperbee.db.feed.key.toString('hex'));
  } catch (err) {
    console.log('ERROR: ', err);
    t.error(err);
  }
});

test('Hyperbee - Test put/get', async t => {
  t.plan(1);

  try {
    hyperbee.privKey = keypair.privateKey;
    hyperbee.pubKey = keypair.publicKey;

    await hyperbee.put('hello', 'world');
    const val = await hyperbee.get('hello');
    t.equals(val, 'world');
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(async () => {
  process.exit(0);
});