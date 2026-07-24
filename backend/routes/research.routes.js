const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const ResearchController = require('../controllers/research.controller');
const router = express.Router();

// Lancer une recherche massive classique
router.post('/start', requireAuth, ResearchController.startResearch);

// Lancer la boucle d'exploration IA autonome (Deep Research)
router.post('/autonomous-loop', requireAuth, ResearchController.startAutonomousLoop);

module.exports = router;