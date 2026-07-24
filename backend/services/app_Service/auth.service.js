const bcrypt = require('bcrypt');
const UserModel = require('../../models/user.model');

class AuthService {
    /**
     * Valide les identifiants de l'utilisateur
     */
    static async authenticate(username, password) {
        const user = await UserModel.findByUsername(username);
        
        if (!user) {
            throw new Error("Identifiant ou mot de passe incorrect.");
        }
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw new Error("Identifiant ou mot de passe incorrect.");
        }
        
        return user;
    }
}

module.exports = AuthService;