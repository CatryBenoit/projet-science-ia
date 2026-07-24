const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const SettingsController = require('../controllers/settings.controller');
const router = express.Router();

router.get('/', requireAuth, SettingsController.getSettings);
router.post('/', requireAuth, SettingsController.saveSettings);

module.exports = router;