const hypertrie = require('hypertrie');
const hyperswarm = require('hyperswarm');
// const hypercore = require('hypercore');
const crypto = require('crypto');
// const swarm = hyperswarm();
const swarm2 = hyperswarm();
// const trie = hypertrie('./server-trie.db', { valueEncoding: 'json' });
const MultiHyperbee = require('./lib/hyperbee');
const Account = require('./lib/account');
const pump = require('pump');

const { secretBoxKeypair, signingKeypair } = Account.makeKeys();

const { db } = new MultiHyperbee(__dirname + '/meta.db/peer1');
const topicHex = crypto.createHash('sha256')
  .update('58b368192a48fcf67')
  .digest();

//SEVER
(async () => {
  const meta = {
    owner: secretBoxKeypair.publicKey
  };

  await db.ready();
  //await db.addPeer('74a1194a7147c088098bd0fbd3dc7da0be4ecdb98811f1a13255550c8e12ed12');

  const diffHyperbee = await db.getDiff();
  const diffFeed = diffHyperbee.feed;

  console.log(`diffFeed key: ${diffFeed.key.toString('hex')}`);

  // await db.put('gareth', meta);
  // await db.put('tset', { foo: 'bar223' });
  await db.put('tset22', {foo:'bar223'});

  startSwarm(db, topicHex);
})();

async function startSwarm(db, topic) {
  const swarm = hyperswarm();
  swarm.join(topic, { lookup: true, announce: true });

  swarm.on('connection', async (socket, info) => {
    let stream = await db.replicate(info.client, { stream: socket, live: true });
    pump(socket, stream, socket);
  });
}


// trie.ready(() => {
//   console.log(trie.key.toString('hex'));
//   trie.put('topic', '58b368192a48fcf671d9571ecbe35a');

  // const topic = crypto.createHash('sha256')
  //   .update(`testtopicgoeshere`)
  //   .digest();

  // swarm.join(topic, {
  //   lookup: true,
  //   announce: true
  // });

  // swarm.on('connection', (socket, info) => {
  //   socket.pipe(trie.replicate(true)).pipe(socket);
  // });
// });

const topic2 = crypto.createHash('sha256')
  .update('58b368192a48fcf671d9571ecbe35a')
  .digest();

swarm2.join(topic2, {
  lookup: true,
  announce: true
});


swarm2.on('connection', (socket, info) => {
  setTimeout(() => { 
    socket.write(Buffer.from('hey', 'utf8'));
    socket.once('data', (id) => {
      info.deduplicate(Buffer.from('hey', 'utf8'), id);
    });
    }, 3000);
});
