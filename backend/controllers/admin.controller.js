const amdinService = require('../services/app_Service/admin.sevice')



const db = require('../config/db');
const bcrypt = require('bcrypt');

class AdminController {
    // 👥 Récupérer tous les utilisateurs (sans les mots de passe)
    static async getAllUsers(req, res) {
        db.all(`SELECT id, username, role FROM users`, [], (err, rows) => {
            if (err) {
                console.error("Erreur getAllUsers:", err);
                return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
            }
            res.status(200).json(rows);
        });
    }

    // ➕ Créer un nouvel utilisateur
    static async createUser(req, res) {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Le nom d'utilisateur et le mot de passe sont requis." });
        }

        try {
            // Hachage du mot de passe pour la sécurité
            const hashedPassword = await bcrypt.hash(password, 10);
            const userRole = role === 'admin' ? 'admin' : 'user';

            db.run(
                `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                [username, hashedPassword, userRole],
                function (err) {
                    if (err) {
                        // Le code SQLITE_CONSTRAINT indique généralement que le nom d'utilisateur existe déjà (UNIQUE)
                        if (err.code === 'SQLITE_CONSTRAINT') {
                            return res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris." });
                        }
                        return res.status(500).json({ error: "Erreur lors de la création de l'utilisateur." });
                    }
                    res.status(201).json({ message: "Utilisateur créé avec succès !", id: this.lastID });
                }
            );
        } catch (error) {
            console.error("Erreur createUser:", error);
            res.status(500).json({ error: "Erreur serveur." });
        }
    }

    // 🗑️ Supprimer un utilisateur
    static async deleteUser(req, res) {
        const userId = req.params.id;

        // Mesure de sécurité : Empêcher l'admin par défaut (ID 1) d'être supprimé
        if (parseInt(userId) === 1) {
            return res.status(403).json({ error: "Le compte administrateur principal ne peut pas être supprimé." });
        }

        db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
            if (err) {
                console.error("Erreur deleteUser:", err);
                return res.status(500).json({ error: "Erreur lors de la suppression." });
            }
            res.status(200).json({ message: "Utilisateur supprimé avec succès." });
        });
    }

    static async resetPassword(req, res) {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({ error: "L'ID de l'utilisateur et le nouveau mot de passe sont requis." });
        }

        try {
            // On hache le nouveau mot de passe
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            db.run(
                `UPDATE users SET password = ? WHERE id = ?`,
                [hashedPassword, userId],
                function (err) {
                    if (err) {
                        console.error("Erreur resetPassword:", err);
                        return res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe." });
                    }
                    // this.changes permet de savoir si une ligne a bien été modifiée dans SQLite
                    if (this.changes === 0) {
                        return res.status(404).json({ error: "Utilisateur non trouvé." });
                    }
                    res.status(200).json({ message: "Mot de passe réinitialisé avec succès !" });
                }
            );
        } catch (error) {
            console.error("Erreur resetPassword:", error);
            res.status(500).json({ error: "Erreur serveur." });
        }
    }
}

module.exports = AdminController;