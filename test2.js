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
  await db.addPeer('c9dd4a59aec5e4ef953efbb5312ed30cf4c8413305850a5fe2379d193b338cae');

  const diffHyperbee = await db.getDiff();
  const diffFeed = diffHyperbee.feed;

  console.log(`diffFeed key: ${diffFeed.key.toString('hex')}`);

  // await db.put('testMoni', { foo1: 'bar21231323' });
  // await db.put('testGareth', { foo2: 'bar21dfdf231323' });
  // await db.put('tset', { foo3: 'dfadff' });
  // await db.put('gman1', { dd: 'dfafd' });
  // await db.put('gman2', { dfa1: 'fd2e13123123' });

  const rs = diffHyperbee.createHistoryStream();
  
  rs.on('data', async(data) => {
    console.log(data);
  })

  startSwarm(db, topicHex);

  await db.close();
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
