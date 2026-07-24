const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const AiController = require('../controllers/ai.controller');


router.post('/ask-nvidia', requireAuth, AiController.askRawAi);
router.post('/projects/:projectId/chat', requireAuth, AiController.projectChat);
router.post('/projects/:projectId/dataviz', requireAuth, AiController.projectDataviz);

module.exports = router;