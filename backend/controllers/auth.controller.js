const AuthService = require('../services/app_Service/auth.service');

class AuthController {
    
    // Route : /login
    static async login(req, res) {
        const { username, password } = req.body;
        
        try {
            const user = await AuthService.authenticate(username, password);
            
            // Création de la session
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            
            res.json({ message: "Connecté avec succès", username: user.username, role: user.role });
            
        } catch (error) {
            // Si l'erreur vient de notre service (mot de passe invalide)
            if (error.message === "Identifiant ou mot de passe incorrect.") {
                return res.status(401).json({ error: error.message });
            }
            // Si c'est une erreur technique (BDD inaccessible, etc.)
            console.error("Erreur serveur lors de la connexion:", error);
            res.status(500).json({ error: "Erreur serveur" });
        }
    }

    // Route : /logout
    static logout(req, res) {
        req.session.destroy();
        res.json({ message: "Déconnecté" });
    }

    // Route : /me
    static me(req, res) {
        if (req.session.userId) {
            res.json({ username: req.session.username, role: req.session.role });
        } else {
            res.status(401).json({ error: "Non connecté" });
        }
    }
}

module.exports = AuthController;