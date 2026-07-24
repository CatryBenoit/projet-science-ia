const wol = require('wake_on_lan');
const ping = require('ping');

class WolService {
    /**
     * Vérifie si la machine cible est en ligne via un Ping
     */
    static async checkStatus() {
        const targetIp = process.env.TARGET_IP;
        
        if (!targetIp) {
            throw new Error("L'adresse IP cible (TARGET_IP) n'est pas définie dans le fichier .env");
        }

        const result = await ping.promise.probe(targetIp, { timeout: 2 });
        return result.alive;
    }

    /**
     * Envoie un paquet magique (Wake-on-LAN) pour allumer la machine
     */
    static wakeMachine() {
        return new Promise((resolve, reject) => {
            const macAddress = process.env.MAC_ADDRESS;
            
            if (!macAddress) {
                return reject(new Error("L'adresse MAC (MAC_ADDRESS) n'est pas définie dans le fichier .env"));
            }

            wol.wake(macAddress, (error) => {
                if (error) {
                    reject(new Error("Erreur lors de l'envoi du paquet magique."));
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = WolService;