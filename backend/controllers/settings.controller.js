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

    // Teste la validité d'une URL et d'une clé API
    static async testProvider(req, res) {
        const { base_url, api_key } = req.body;
        try {
            const axios = require('axios');
            // La plupart des API compatibles OpenAI ont une route /models pour lister les modèles disponibles
            const endpoint = `${base_url.replace(/\/+$/, '')}/models`;
            
            await axios.get(endpoint, {
                headers: {
                    "Authorization": `Bearer ${api_key || 'local'}`,
                    "Content-Type": "application/json"
                },
                timeout: 5000 // Timeout court (5 secondes) pour ne pas bloquer l'UI
            });

            res.status(200).json({ success: true, message: "Connexion établie." });
        } catch (error) {
            console.error("Échec du test de connexion :", error.message);
            res.status(400).json({ error: "Échec de la connexion au fournisseur." });
        }
    }

    // Met à jour un fournisseur existant
    static async updateProvider(req, res) {
        try {
            const providerId = req.params.id;
            const { name, base_url, api_key } = req.body;
            const userId = req.user?.id || req.userId || 1;

            const db = require('../config/db');
            
            await new Promise((resolve, reject) => {
                db.run(
                    // CORRECTION : api_providers au lieu de ai_providers
                    `UPDATE api_providers SET name = ?, base_url = ?, api_key = ? WHERE id = ? AND user_id = ?`,
                    [name, base_url, api_key, providerId, userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            res.status(200).json({ message: "Fournisseur mis à jour." });
        } catch (error) {
            console.error("Erreur updateProvider:", error);
            res.status(500).json({ error: "Erreur serveur." });
        }
    }

    // Supprime un fournisseur
    static async deleteProvider(req, res) {
        try {
            const providerId = req.params.id;
            const userId = req.user?.id || req.userId || 1;

            const db = require('../config/db');
            
            // 1. Supprimer le fournisseur
            await new Promise((resolve, reject) => {
                // CORRECTION : api_providers
                db.run(`DELETE FROM api_providers WHERE id = ? AND user_id = ?`, [providerId, userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 2. Nettoyer les routes qui utilisaient ce fournisseur (fallback sur défaut)
            await new Promise((resolve, reject) => {
                // CORRECTION : model_routing au lieu de ai_routing
                db.run(`DELETE FROM model_routing WHERE provider_id = ? AND user_id = ?`, [providerId, userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.status(200).json({ message: "Fournisseur supprimé." });
        } catch (error) {
            console.error("Erreur deleteProvider:", error);
            res.status(500).json({ error: "Erreur serveur." });
        }
    }
}

module.exports = SettingsController;