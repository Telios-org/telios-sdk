const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const del = require('del');


// create a seeded drive
test('Cleanup', async t => {
    t.ok(1);
});


test.onFinish(async () => {
  // Clean up session
  await del([
    // __dirname + '/drive_cloned',
    __dirname + '/meta',
    __dirname + '/.tmp',
    __dirname + '/drive/.drive'
  ]);
  process.exit(0);
});