const express = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const AdminController = require('../controllers/admin.controller');
const router = express.Router();

// Toutes ces routes sont protégées par requireAdmin (qui nécessite d'être connecté ET d'être admin)
router.get('/users', requireAdmin, AdminController.getAllUsers);
router.post('/users', requireAdmin, AdminController.createUser);
router.delete('/users/:id', requireAdmin, AdminController.deleteUser);

// Route pour réinitialiser le mot de passe d'un utilisateur
router.post('/reset-password', requireAdmin, AdminController.resetPassword);

module.exports = router;