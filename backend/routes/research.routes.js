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

module.exports = router;