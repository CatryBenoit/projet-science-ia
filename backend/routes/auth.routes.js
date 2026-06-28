const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Erreur serveur" });
        if (!user) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
        
        // Création de la session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        res.json({ message: "Connecté avec succès", username: user.username, role: user.role });
    });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: "Déconnecté" });
});

router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({ username: req.session.username, role: req.session.role });
    } else {
        res.status(401).json({ error: "Non connecté" });
    }
});

module.exports = router;