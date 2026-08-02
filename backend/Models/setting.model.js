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
}

module.exports = SettingsModel;



