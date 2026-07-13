const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth.middleware');

// Lire les paramètres
router.get('/', requireAuth, (req, res) => {
    db.get("SELECT api_key, ai_model FROM user_settings WHERE id = 1", (err, row) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        res.json(row || { api_key: '', ai_model: 'meta-llama/llama-3.1-70b-instruct' });
    });
});

// Sauvegarder les paramètres
router.post('/', requireAuth, (req, res) => {
    const { api_key, ai_model } = req.body;
    db.run(
        `INSERT OR REPLACE INTO user_settings (id, api_key, ai_model) VALUES (1, ?, ?)`,
        [api_key, ai_model],
        function(err) {
            if (err) return res.status(500).json({ error: "Erreur de sauvegarde" });
            res.json({ success: true });
        }
    );
});

module.exports = router;