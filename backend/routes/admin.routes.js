const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const router = express.Router();

router.post('/create-user', requireAuth, requireAdmin, async (req, res) => {
    const { username, tempPassword } = req.body;
    try {
        const hashedPwd = await bcrypt.hash(tempPassword, 10);
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hashedPwd, 'user'], (err) => {
            if (err) return res.status(400).json({ error: "Cet utilisateur existe déjà." });
            res.json({ message: `Utilisateur ${username} créé avec succès.` });
        });
    } catch (e) { 
        res.status(500).json({ error: "Erreur serveur" }); 
    }
});

router.post('/reset-password', requireAuth, requireAdmin, async (req, res) => {
    const { username, newTempPassword } = req.body;
    try {
        const hashedPwd = await bcrypt.hash(newTempPassword, 10);
        db.run("UPDATE users SET password = ? WHERE username = ?", [hashedPwd, username], function(err) {
            if (err) return res.status(500).json({ error: "Erreur serveur" });
            if (this.changes === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
            res.json({ message: `Mot de passe de ${username} réinitialisé.` });
        });
    } catch (e) { 
        res.status(500).json({ error: "Erreur serveur" }); 
    }
});

module.exports = router;