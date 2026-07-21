const express = require('express');
const ResearchServiceMassive = require('../services/research.service');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

router.post('/start', requireAuth, async (req, res) => {
    // On récupère le projectId envoyé par le Frontend
    const { topic, amount, projectId } = req.body;

    if (!topic) return res.status(400).json({ error: "Sujet de recherche manquant." });
    if (!projectId) return res.status(400).json({ error: "Un projet doit être sélectionné." }); // NOUVEAU

    res.json({ message: `🚀 Recherche lancée pour "${topic}" dans le projet #${projectId} !` });

    try {
        // On passe le projectId à notre service
        await ResearchServiceMassive.startMassiveResearch(topic, amount, projectId);
    } catch (error) {
        console.error("Erreur critique :", error);
    }
});

router.post('/autonomous-loop', requireAuth, async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "ID du projet requis." });

    try {
        // On exécute la boucle en tâche de fond sans utiliser 'await'
        // Cela permet de répondre immédiatement au navigateur et d'éviter un timeout HTTP de 60s
        ResearchServiceMassive.launchAutonomousLoop(projectId);
        
        res.json({ 
            success: true, 
            message: "🤖 Agent Deep Research lancé en tâche de fond ! Suivez sa progression dans le Terminal Live." 
        });
    } catch (err) {
        console.error("Erreur lancement boucle autonome:", err);
        res.status(500).json({ error: "Échec du lancement de la boucle autonome." });
    }
});

module.exports = router;