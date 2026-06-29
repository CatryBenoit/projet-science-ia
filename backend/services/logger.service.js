const EventEmitter = require('events');

class AppLogger extends EventEmitter {
    log(message) {
        // 1. On affiche le message dans le vrai terminal de ton PC
        console.log(message);
        
        // 2. On envoie le message à travers internet vers ton interface React
        this.emit('new_log', message);
    }
}

// On exporte une instance unique (Singleton) pour que toute l'app utilise le même haut-parleur
module.exports = new AppLogger();