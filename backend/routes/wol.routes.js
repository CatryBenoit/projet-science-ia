const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const WolController = require('../controllers/wol.controller');
const router = express.Router();

router.get('/status', requireAuth, WolController.getStatus);
router.post('/wake', requireAuth, WolController.wakeUp);

module.exports = router;