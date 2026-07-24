const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const adminController = require('../controllers/admin.controller')
const router = express.Router();


// route permetant de crée un utilisateur par l'admin 
router.post('/create-user', requireAuth, requireAdmin,adminController.createUser);


// route pour reinisaliser le mot de passe d'un utlisateur 
router.post("/reset-password", requireAuth, requireAdmin, adminController.resetPassword);

module.exports = router;