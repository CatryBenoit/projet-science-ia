const db = require('../config/db');

exports.create = (username, hash) => {

    return db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, 'user'], (err) => {
        if (err) return res.status(400).json({ error: "Cet utilisateur existe déjà." });
        res.json({ message: `Utilisateur ${username} créé avec succès.` });
    });
};

exports.updatePassword = (username, hash) => {
    return db.run(
        "UPDATE users SET password=? WHERE username=?",
        [hash, username]
    );
};

module.exports = updatePassword;    



class UserModel {
    /**
     * Recherche un utilisateur par son nom d'utilisateur
     */
    static findByUsername(username) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
    }
}

module.exports = UserModel;