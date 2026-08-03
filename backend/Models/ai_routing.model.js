const db = require('../config/db');

class AiRoutingModel {
    
    // 🔍 Récupère la configuration exacte pour un rôle précis
    static getRouteForRole(userId, role) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.model_name, 
                    p.base_url, 
                    p.api_key 
                FROM model_routing m
                JOIN api_providers p ON m.provider_id = p.id
                WHERE m.user_id = ? AND m.role = ?
            `;
            db.get(query, [userId, role], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // ➕ Ajoute un nouveau fournisseur d'API
    static addProvider(userId, name, baseUrl, apiKey) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO api_providers (user_id, name, base_url, api_key) VALUES (?, ?, ?, ?)`,
                [userId, name, baseUrl, apiKey],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // 🔀 Assigne un modèle d'un fournisseur à un rôle précis
    static assignModelToRole(userId, providerId, role, modelName) {
        return new Promise((resolve, reject) => {
            // INSERT OR REPLACE fonctionne grâce à la contrainte UNIQUE(user_id, role)
            const query = `
                INSERT OR REPLACE INTO model_routing (user_id, provider_id, role, model_name) 
                VALUES (?, ?, ?, ?)
            `;
            db.run(query, [userId, providerId, role, modelName], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // 📖 Récupère tous les fournisseurs d'API d'un utilisateur
    static getProviders(userId) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, name, base_url FROM api_providers WHERE user_id = ?`, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // 📖 Récupère toutes les assignations (rôles) d'un utilisateur
    static getAllRoutings(userId) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT provider_id, role, model_name FROM model_routing WHERE user_id = ?`, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
}

module.exports = AiRoutingModel;