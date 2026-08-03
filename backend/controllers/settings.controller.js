const SettingsModel = require('../Models/settings.model');
const AiRoutingModel = require('../Models/ai_routing.model');
const Logger = require('../services/app_Service/logger.service');

class SettingsController {
    
    // ==========================================
    // ⚙️ ANCIENNES MÉTHODES (Paramètres globaux)
    // ==========================================
    static async getSettings(req, res) {
        try {
            const settings = await SettingsModel.getSettings();
            res.status(200).json(settings || {});
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateSettings(req, res) {
        try {
            await SettingsModel.updateSettings(req.body);
            res.status(200).json({ message: "Paramètres mis à jour avec succès" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // ==========================================
    // 🔌 GESTION DES FOURNISSEURS (API PROVIDERS)
    // ==========================================
    static getProviders = async (req, res) => {
        try {
            const userId = req.user?.id || req.userId || 1;
            const providers = await AiRoutingModel.getProviders(userId);
            res.status(200).json(providers);
        } catch (error) {
            Logger.log(`❌ Erreur getProviders : ${error.message}`);
            res.status(500).json({ error: "Erreur lors de la récupération des fournisseurs." });
        }
    };

    static addProvider = async (req, res) => {
        try {
            const userId = req.user?.id || req.userId || 1;
            const { name, base_url, api_key } = req.body;

            if (!name || !base_url || !api_key) {
                return res.status(400).json({ error: "Nom, Base URL et Clé API sont requis." });
            }

            const providerId = await AiRoutingModel.addProvider(userId, name, base_url, api_key);
            res.status(201).json({ success: true, providerId, message: "Fournisseur ajouté avec succès !" });
        } catch (error) {
            Logger.log(`❌ Erreur addProvider : ${error.message}`);
            res.status(500).json({ error: "Erreur lors de l'ajout du fournisseur." });
        }
    };

    // ==========================================
    // 🔀 GESTION DU ROUTAGE (ROLES & MODELES)
    // ==========================================
    static getRouting = async (req, res) => {
        try {
            const userId = req.user?.id || req.userId || 1;
            const routings = await AiRoutingModel.getAllRoutings(userId);
            res.status(200).json(routings);
        } catch (error) {
            Logger.log(`❌ Erreur getRouting : ${error.message}`);
            res.status(500).json({ error: "Erreur lors de la récupération du routage." });
        }
    };

    static assignRole = async (req, res) => {
        try {
            const userId = req.user?.id || req.userId || 1;
            const { provider_id, role, model_name } = req.body;

            if (!provider_id || !role || !model_name) {
                return res.status(400).json({ error: "ID Fournisseur, Rôle et Nom du modèle sont requis." });
            }

            await AiRoutingModel.assignModelToRole(userId, provider_id, role, model_name);
            res.status(200).json({ success: true, message: `Modèle assigné au rôle ${role} avec succès !` });
        } catch (error) {
            Logger.log(`❌ Erreur assignRole : ${error.message}`);
            res.status(500).json({ error: "Erreur lors de l'assignation du rôle." });
        }
    };
}

module.exports = SettingsController;