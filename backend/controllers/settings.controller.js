const SettingsService = require('../services/app_Service/settings.service');

class SettingsController {
    
    // Route : GET /
    static async getSettings(req, res) {
        try {
            const settings = await SettingsService.getSettings();
            res.json(settings);
        } catch (error) {
            console.error("Erreur lecture paramètres:", error);
            res.status(500).json({ error: "Erreur lors de la récupération des paramètres." });
        }
    }

    // Route : POST /
    static async saveSettings(req, res) {
        try {
            await SettingsService.saveSettings(req.body);
            res.json({ success: true });
        } catch (error) {
            console.error("Erreur sauvegarde paramètres:", error);
            res.status(500).json({ error: "Erreur lors de la sauvegarde des paramètres." });
        }
    }
}

module.exports = SettingsController;