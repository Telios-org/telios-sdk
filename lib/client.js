const EventEmitter = require('events');
const hyperswarm = require('hyperswarm');
const crypto = require('crypto');
const swarm = hyperswarm();

class Client extends EventEmitter {
  constructor(opts) {
    super();

    this.provider = opts.provider;
    this.opts = opts;
    this.swarm = swarm;
    this.mailListener();
  }

  mailListener() {
    const topic = crypto.createHash('sha256')
    .update(`${this.opts.auth.claims.peer_key}:newMail`)
    .digest();

    this.swarm.join(topic, {
      lookup: true,
      announce: true
    });

    this.swarm.on('connection', (socket, info) => {
      socket.on('data', (data) => {
        const str = data.toString('utf8');
        const message = JSON.parse(str);

        if (message && message.event) {
          this.emit(message.event, message); 
        }
      })
    });
  }
}

module.exports = Client;