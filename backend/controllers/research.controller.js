const ResearchServiceMassive = require('../services/IA_service/research.service');

class ResearchController {
    
    // Route : /start
    static async startResearch(req, res) {
        // 🛑 On prépare l'arrivée de "filters" pour le filtrage Date/Langue
        const { topic, amount, projectId, filters } = req.body; 

        if (!topic) return res.status(400).json({ error: "Sujet de recherche manquant." });
        if (!projectId) return res.status(400).json({ error: "Un projet doit être sélectionné." });

        // On répond immédiatement au Frontend pour ne pas faire tourner le chargement à l'infini
        res.json({ message: `🚀 Recherche lancée pour "${topic}" dans le projet #${projectId} !` });

        try {
            // Lancement en tâche de fond (sans 'await' bloquant pour la réponse HTTP)
            // On ajoute le .catch() pour sécuriser le thread en arrière-plan
            ResearchServiceMassive.startMassiveResearch(topic, amount, projectId, filters)
                .catch(err => console.error("Erreur asynchrone lors de la recherche massive :", err));
        } catch (error) {
            console.error("Erreur critique au lancement de la recherche :", error);
        }
    }

    // Route : /autonomous-loop
    static async startAutonomousLoop(req, res) {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: "ID du projet requis." });

        try {
            // Lancement en tâche de fond
            ResearchServiceMassive.launchAutonomousLoop(projectId)
                .catch(err => console.error("Erreur asynchrone boucle autonome :", err));
            
            res.json({ 
                success: true, 
                message: "🤖 Agent Deep Research lancé en tâche de fond ! Suivez sa progression dans le Terminal Live." 
            });
        } catch (err) {
            console.error("Erreur lancement boucle autonome:", err);
            res.status(500).json({ error: "Échec du lancement de la boucle autonome." });
        }
    }
}

module.exports = ResearchController;