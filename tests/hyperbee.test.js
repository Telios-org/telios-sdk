const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Crypto, Hyperbee } = require('..');
const Hypercore = require('hypercore');

let hyperbee = null;
const keypair = Crypto.generateSBKeypair();

test('Hyperbee - Create new db', async t => {
  t.plan(1);

  try {
    const feed = Hypercore('./tests/storage')
    hyperbee = new Hyperbee(feed);
    feed.on('ready', () => {
      t.ok(hyperbee.db.feed.key.toString('hex'));
    });
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

    await hyperbee.put('hello', {
      data: {
        value: 'world'
      }
    });
    const item = await hyperbee.get('hello');
    
    t.equals(item.value, 'world');
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(async () => {
  process.exit(0);
});