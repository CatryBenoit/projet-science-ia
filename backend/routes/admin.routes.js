const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const router = express.Router();
const adminController = require('../controllers/admin.controller')

// route permetant de crée un utilisateur par l'admin 
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


// route pour reinisaliser le mot de passe d'un utlisateur 
router.post("/reset-password", requireAuth, requireAdmin, adminController.resetPassword);

module.exports = router;