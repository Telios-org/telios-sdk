const EventEmitter = require('events');
const pump = require('pump');
const Hyperswarm = require('hyperswarm');
const p2plex = require('p2plex');

class Swarm extends EventEmitter {
  constructor({ db, keyPair, topic, lookup, announce, ephemeral }) {
    super();

    if(!Buffer.isBuffer(topic)) {
      topic = Buffer.from(topic, 'hex');
    }

    this.hyperswarm = Hyperswarm({ ephemeral });
    this.db = db;
    this.keyPair = keyPair;
    this.topic = topic;
    this.lookup = lookup;
    this.announce = announce;
    this.ephemeral = ephemeral;
    this.peerList = {};
    this.plexConnections = [];

    this.init();
  }

  init() {
    this.hyperswarm.join(this.topic, { lookup: this.lookup, announce: this.announce });

    this.hyperswarm.on('connection', async (socket, info) => {
      if (this.db) {
        // If DB then this swarm is being used for replication between seeding drives
        let stream = await this.db.replicate(info.client, { stream: socket, live: true });
        pump(socket, stream, socket);
      } else {
        // Else use this swarm to discover peers looking for drive content
        if(this.announce) {
          socket.end(JSON.stringify({ publicKey: this.keyPair.publicKey }), 'utf-8');
          
          // Listen for file requests and emit
          const plex = p2plex();
          const topic = Buffer.from(this.keyPair.publicKey, 'hex');

          plex.join(topic, { announce: true, lookup: false });

          plex.on('connection', peer => {
            const stream = peer.receiveStream('request');
            
            stream.on('data', data => {
              this.emit('file-request', JSON.parse(data.toString('utf-8')), peer);
            });
          });

          this.plexConnections.push(plex);
        }

        // Look up peers seeding the drive
        if(this.lookup) {
          socket.once('data', async data => {
            const peer = JSON.parse(data.toString('utf-8'));
            // Ignore self-announced publicKey
            if(peer.publicKey !== this.keyPair.publicKey && info.peer) {
              this.peerList[info.peer.host] = peer;
              this.emit('peer-add', peer);
            }
          });
        }
      }
    });

    // this.hyperswarm.on('disconnection', (socket, info) => {
    //   if(
    //     info.peer && 
    //     this.peerList[info.peer.host] && 
    //     this.lookup &&
    //     !this.db &&
    //     this.peerList[info.peer.host].publicKey !== this.keyPair.publicKey
    //   ) {
    //     console.log('Deleting ', this.peerList[info.peer.host]);
    //     delete this.peerList[info.peer.host];
    //   }
    // });
  }

  async refreshPeers() {
    console.log('Refresh Peers :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::')
    this.peerList = {};
    const hyperswarm = Hyperswarm();
    hyperswarm.join(this.topic, { lookup: this.lookup, announce: this.announce });
    
    return new Promise((resolve, reject) => {
      hyperswarm.on('connection', async (socket, info) => {
        if (!this.db && this.lookup) {
          // Look up peers seeding the drive
          socket.once('data', async data => {
            const peer = JSON.parse(data.toString('utf-8'));
            // Ignore self-announced publicKey
            if(peer.publicKey !== this.keyPair.publicKey && info.peer) {
              this.peerList[info.peer.host] = peer;
              await hyperswarm.leave(this.topic);
              return resolve(peer);
            }
          });
        }
      });

      setTimeout(async () => {
        await hyperswarm.leave(this.topic);
        return reject('Failed to connect to any peers within the alotted time.')
      }, 5000);
    });
  }

  async close() {
    await this.hyperswarm.leave(this.topic); // This can take some time to close
  }
}

module.exports = Swarm;