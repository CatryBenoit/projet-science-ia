const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth.middleware');

// Lire les paramètres
router.get('/', requireAuth, (req, res) => {
    db.get("SELECT api_key, ai_model, api_base_url, max_iterations FROM user_settings WHERE id = 1", (err, row) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        res.json(row || { 
            api_key: '', 
            ai_model: 'meta-llama/llama-3.1-70b-instruct',
            api_base_url: 'https://integrate.api.nvidia.com/v1',
            max_iterations: 2
        });
    });
});

// Sauvegarder les paramètres
router.post('/', requireAuth, (req, res) => {
    const { api_key, ai_model, api_base_url, max_iterations } = req.body;
    db.run(
        `INSERT OR REPLACE INTO user_settings (id, api_key, ai_model, api_base_url, max_iterations) VALUES (1, ?, ?, ?, ?)`,
        [api_key, ai_model, api_base_url || 'https://integrate.api.nvidia.com/v1', parseInt(max_iterations) || 2],
        function(err) {
            if (err) return res.status(500).json({ error: "Erreur de sauvegarde" });
            res.json({ success: true });
        }
    );
});

module.exports = router;