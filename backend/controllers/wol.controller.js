const WolService = require('../services/app_Service/wol.service');

class WolController {
    
    // Route : GET /status
    static async getStatus(req, res) {
        try {
            const isOnline = await WolService.checkStatus();
            res.json({ isOnline });
        } catch (error) {
            console.error("Erreur Ping:", error.message);
            res.status(500).json({ error: error.message || "Erreur lors du ping" });
        }
    }

    // Route : POST /wake
    static async wakeUp(req, res) {
        try {
            await WolService.wakeMachine();
            res.json({ message: "Signal Wake-on-LAN envoyé !" });
        } catch (error) {
            console.error("Erreur WOL:", error.message);
            res.status(500).json({ error: error.message || "Erreur lors du réveil de la machine." });
        }
    }
}

module.exports = WolController;