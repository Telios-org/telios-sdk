const SDK = require('dat-sdk');
const hypertrie = require('hypertrie');
const ram = require('random-access-memory');
const hyperbee = require('hyperbee');
const hypercore = require('hypercore');




var feed = hypercore('./my-first-dataset')
  feed.on('close', () => {
    console.log('FEED CLOSED');
  });

  feed.on('ready', async () => {

  

  

    const Hyperbee = require('hyperbee')
    const db = new Hyperbee(feed, {
      keyEncoding: 'utf-8', // can be set to undefined (binary), utf-8, ascii or and abstract-encoding
      valueEncoding: 'binary' // same options as above
    })

    // if you own the feed
    await db.put('key', 'value')
    await db.del('some-key')

    // if you want to insert/delete batched values
    const batch = db.batch()

    await batch.put('key', 'value')
    await batch.del('some-key')
    await batch.flush() // execute the batch

    // if you want to query the feed
    const node = await db.get('key') // null or { key, value }

    db.feed.close();
  });












(async () => {


  // const sdk = await SDK();
  // const {
  //   Hypercore,
  //   Hyperdrive,
  //   resolveName,
  //   close
  // } = sdk;

  // // const feed = new Hypercore('my hypercore name', {
  // //   valueEncoding: 'json',
  // //   persist: true,
  // //   // storage can be set to an instance of `random-access-*`
  // //   // const RAI = require('random-access-idb')
  // //   // otherwise it defaults to `random-access-web` in the browser
  // //   // and `random-access-file` in node
  // // });

  // // feed.on('peer-add', (peer) => {
  // //   console.log('PEER ADDED!');
  // // });

  // // await feed.ready();

  // // console.log(feed.discoveryKey.toString('hex'));

  // const myCore = new Hypercore('a1a9ccbbb94a57b7b2b9d87e8b525db2c3d9409b07c3c43d63b478dc3f68437e', {
  //   persist: true,
  //   sparse: true,
  //   eagerUpdate: true
  // });

  // // myCore.download(null, (err, data) => {
  // //   console.log('Done downloading feed');
  // // });


  // // Pass in hypercores from the SDK into other dat data structures
  // // Check out what you can do with hypertrie from there:
  // // https://github.com/mafintosh/hypertrie
  // const trie = hypertrie(null, {
  //   feed: myCore,
  //   alwaysUpdate: true
  // });

  // // myCore.on('download', async (index, data) => {
  // //   const ite = (trie.diff(trie.version - 1));

  // //   ite.next((err, data) => {
  // //     if (data.left) {
  // //       console.log('LEFT :: ', data.left.key + ':' + data.left.value.toString('utf-8'));
  // //     }

  // //     if (data.right) {
  // //       console.log('RIGHT :: ', data.right.key + ':' + data.right.value.toString('utf-8'));
  // //     }
  // //   });
  // // });

  // // myCore.download(null, () => {
    
  // // });
  
  // setInterval(() => {
  //   // myCore.download(null, (err, data) => {
  //   //   console.log('Done downloading feed');
  //   // });

  //   trie.get('hello', (err, node) => {
  //     console.log(node.value.toString())
  //   })
  // }, 2000)
})();