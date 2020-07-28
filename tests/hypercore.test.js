
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { Hypercore } = require('..');

test('Hypercore - create and get core', async t => {
  t.plan(3);
  const opts = {
    name: 'Test Core',
    coreOpts: {
      persist: false
    }
  };

  const hypercore = new Hypercore(opts);
  const core = await hypercore.createCore();
  const key = core.key.toString('hex');

  t.ok(key, `Generated core key 1`);

  const core2 = await Hypercore.getCore(key);
  const key2 = core2.key.toString('hex');
  
  await core.close();
  await core2.close();

  t.ok(key, `Generated core key 2`);

  t.equals(key, key2, 'Core keys match');
});

test.onFinish(() => process.exit(0));