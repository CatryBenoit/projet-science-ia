const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settings.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// ⚙️ Anciennes routes (Paramètres globaux)
router.get('/', requireAuth, SettingsController.getSettings);
router.post('/', requireAuth, SettingsController.updateSettings);

// 🔌 Routes pour les fournisseurs d'API
router.get('/providers', requireAuth, SettingsController.getProviders);
router.post('/providers', requireAuth, SettingsController.addProvider);

// 🔀 Routes pour le routage des rôles
router.get('/routing', requireAuth, SettingsController.getRouting);
router.post('/routing', requireAuth, SettingsController.assignRole);

module.exports = router;