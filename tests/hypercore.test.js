
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const ram = require('random-access-memory');
const { Hypercore } = require('..');

let feed1 = null;
let feed2 = null;

test('Hypercore - Create and Get Core', async t => {
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

// test('Hypercore - Test Extension Messages', async t => {
//   t.plan(2);
//   let opts = {
//     name: 'Test Core',
//     storage: __dirname + '/core',
//     coreOpts: {
//       persist: false
//     }
//   };

//   const hyper1 = new Hypercore(opts);
//   feed1 = await hyper1.createCore();

//   const e1 = feed1.registerExtension('example', {
//     encoding: 'json',
//     onmessage: (message, peer) => {
//       t.equals(JSON.stringify(message), JSON.stringify({ hi: 'e1' }));
//     }
//   });

//   opts = {
//     name: feed1.key.toString('hex'),
//     storage: ram,
//     coreOpts: {
//       persist: false
//     }
//   };

//   const hyper2 = new Hypercore(opts);
//   feed2 = await hyper2.createCore();

//   const e2 = feed2.registerExtension('example', {
//     encoding: 'json',
//     onmessage: (message, peer) => {
//       t.equals(JSON.stringify(message), JSON.stringify({ hi: 'e2' }));
//       e2.send({ hi: 'e1' }, peer);
//     }
//   });

//   feed1.on('peer-open', (peer) => {
//     e1.broadcast({ hi: 'e2' });
//   });
// });

test.onFinish(async () => {
  // await feed1.close();
  // await feed2.close();
  process.exit(0);
});