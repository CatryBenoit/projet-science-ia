const db = require('../config/db');


class SettingsModel {
    /**
     * Récupère les paramètres globaux de l'application
     */
static getSettings() {
        return new Promise((resolve, reject) => {
            db.get("SELECT api_key, ai_model, api_base_url, max_iterations FROM user_settings WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Sauvegarde ou met à jour les paramètres
     */
    static saveSettings(apiKey, aiModel, apiBaseUrl, maxIterations) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO user_settings (id, api_key, ai_model, api_base_url, max_iterations) VALUES (1, ?, ?, ?, ?)`;
            db.run(query, [apiKey, aiModel, apiBaseUrl, maxIterations], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static getUserSetting(id) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT api_key, ai_model, api_base_url, max_iterations FROM user_settings WHERE id = ?",
            [id],
            (err, row) => {
                if (err) {
                    return reject(err);
                }

                if (!row) {
                    return resolve({
                        api_key: null,
                        ai_model: "meta/llama-3.1-70b-instruct" , //defaultModel,
                        api_base_url: process.env.AI_API_URL || process.env.NVIDIA_API_URL || defaultBaseUrl,
                        max_iterations: 2
                    });
                }

                resolve(row);
            }
        );
    });
};

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

module.exports = SettingsModel;



