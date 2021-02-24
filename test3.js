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


const { db } = new MultiHyperbee(__dirname + '/meta.db/peer2');
const topicHex = crypto.createHash('sha256')
  .update('58b368192a48fcf67')
  .digest();

//SEVER
(async () => {
  const meta = {
    topic: '58b368192a48fcf671d9571ecbe35a'
  };

  await db.ready();
  //await db.addPeer('1f7d7f9534881a6078640e0e3b776c331f29042450a12239c61494b3e5ed792a');

  const diffHyperbee = await db.getDiff();
  const diffFeed = diffHyperbee.feed;

  console.log(`diffFeed key: ${diffFeed.key.toString('hex')}`);

  const owner = await db.get('owner');
  const topic = await db.get('topic');
  //await db.put('canWrite', { peers: ['1f7d7f9534881a6078640e0e3b776c331f29042450a12239c61494b3e5ed792a']});
  
  const rs = db.createHistoryStream({ live: true, gte: -1 });

  rs.on('data', async(data) => {
    console.log(data);
  })

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
  announce: false
});


swarm2.on('connection', (socket, info) => {
    socket.on('data', (data) => {
      console.log(data.toString('utf8'));
    });
});
