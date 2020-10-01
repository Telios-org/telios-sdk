const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hypercore } = require('..');
const SDK = require('dat-sdk');


test('Hypercore - Create and Get Core', async t => {
  t.plan(3);
  
  try {
    const sdk = await SDK();

    const opts1 = {
      name: 'Test Core',
      sdk: sdk,
      coreOpts: {
        persist: false
      }
    };

    const hypercore = new Hypercore(opts1);
    await hypercore.connect();
    const feed1 = hypercore.feed;
    const key1 = feed1.key.toString('hex');

    t.ok(key1, `Generated core key 1`);

    const opts2 = {
      name: key1,
      coreOpts: {
        persist: false
      }
    };

    const feed2 = await hypercore.getCore(opts2);
    const key2 = feed2.key.toString('hex');

    await hypercore.close();

    t.ok(key2, `Generated core key 2`);
    t.equals(key1, key2, 'Core keys match');
  } catch (err) {
    t.error(err);
  }
});

test.onFinish(async () => {
  process.exit(0);
});