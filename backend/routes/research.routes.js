const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const ResearchController = require('../controllers/research.controller');
const router = express.Router();

// Lancer une recherche massive classique
router.post('/start', requireAuth, ResearchController.startResearch);

// Lancer la boucle d'exploration IA autonome (Deep Research)
router.post('/autonomous-loop', requireAuth, ResearchController.startAutonomousLoop);

// 🎛️ Route pour changer le mode copilote : PUT /api/research/:id/copilot
router.put('/:id/copilot', ResearchController.toggleCopilot);

// 🟢 Route pour donner le feu vert : POST /api/research/:id/resume
router.post('/:id/resume', ResearchController.resumeResearch);

module.exports = router;