const EventEmitter = require('events');

class AppLogger extends EventEmitter {
    log(message) {
        console.log(message);
        this.emit('new_log', message);
    }
}

module.exports = new AppLogger();