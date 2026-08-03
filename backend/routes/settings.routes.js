const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const SettingsController = require('../controllers/settings.controller');
const router = express.Router();

router.get('/', requireAuth, SettingsController.getSettings);
router.post('/', requireAuth, SettingsController.saveSettings);


router.get('/providers', requireAuth, SettingsController.getProviders);
router.post('/providers', requireAuth, SettingsController.addProvider);

// 🔀 Routes pour le routage des rôles
router.get('/routing', requireAuth, SettingsController.getRouting);
router.post('/routing', requireAuth, SettingsController.assignRole);


module.exports = router;