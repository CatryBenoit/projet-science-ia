const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: "Non autorisé, veuillez vous connecter." });
};

// Vérifie si l'utilisateur est un administrateur
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: "Accès refusé. Droits administrateur requis." });
};

module.exports = { requireAuth, requireAdmin };