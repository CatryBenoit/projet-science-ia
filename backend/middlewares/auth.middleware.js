const db = require('../config/db');

// 1. Vérifie si l'utilisateur est connecté (Ton code existant)
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: "Non autorisé, veuillez vous connecter." });
};

// 2. Vérifie si l'utilisateur connecté est un Administrateur (Nouveau code corrigé)
const requireAdmin = (req, res, next) => {
    // Étape A : L'utilisateur doit être connecté
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Non autorisé, veuillez vous connecter." });
    }

    // Étape B : On va chercher son rôle dans la base de données
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            console.error("Erreur requireAdmin:", err);
            return res.status(500).json({ error: "Erreur serveur lors de la vérification des droits." });
        }
        
        // Si l'utilisateur n'existe pas ou n'est pas admin, on bloque l'accès (403 Forbidden)
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: "Accès refusé : Droits administrateur requis." });
        }
        
        // Si tout est bon, on le laisse passer !
        next();
    }); 
};

module.exports = { requireAuth, requireAdmin };