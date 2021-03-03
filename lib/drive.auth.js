const EventEmitter = require('events');

class Auth extends EventEmitter{
  constructor() {
    super();
  }
}

module.exports = Auth;