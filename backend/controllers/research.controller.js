const ResearchServiceMassive = require('../services/IA_service/research.service');
const ProjectModel = require('../Models/project.model');
const Logger = require('../services/app_Service/logger.service');


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


    /**
 * 🎛️ Activer/Désactiver le Mode Copilote en direct
 */
     static  toggleCopilot = async (req, res) => {
        try {
            const projectId = req.params.id;
            const { copilot_mode } = req.body; // true ou false

            await ProjectModel.setCopilotMode(projectId, copilot_mode);
            Logger.log(`🎛️ Mode Copilote ${copilot_mode ? 'ACTIVÉ' : 'DÉSACTIVÉ'} pour le projet #${projectId}`);

            res.status(200).json({ message: "Mode copilote mis à jour." });
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de la mise à jour du mode copilote." });
        }
    };

/**
 * 🟢 Le "Feu Vert" : Relancer un projet en pause avec les requêtes validées
 */
     static  resumeResearch = async (req, res) => {
        try {
            const projectId = req.params.id;
            const { approvedQueries, currentDepth } = req.body;

            if (!approvedQueries || !Array.isArray(approvedQueries)) {
                return res.status(400).json({ error: "Format invalide. 'approvedQueries' doit être un tableau." });
            }

            Logger.log(`🟢 [CO-PILOTE] Feu vert reçu pour le projet #${projectId}. Relance de la machine...`);

            // 1. On remet le projet en statut actif
            await ProjectModel.updateStatus(projectId, 'IN_PROGRESS');

            // 2. On lance la recherche pour chaque requête validée (ou ajoutée manuellement)
            // Note : On ne met pas de "await" devant startMassiveResearch ici, 
            // pour que l'API réponde immédiatement "OK" au Frontend sans faire attendre l'utilisateur.
            for (const query of approvedQueries) {
                Logger.log(`🚀 [CO-PILOTE] Injection de la requête : "${query}"`);

                ResearchServiceMassive.startMassiveResearch(query, 3, projectId, currentDepth || 1)
                    .catch(err => Logger.log(`❌ Erreur sur la requête ${query}: ${err.message}`));
            }

            // Optionnel : Tu pourrais ajouter ici une commande pour vider la table 'pending_queries'
            // pour ce projet, vu qu'elles viennent d'être traitées.

            res.status(200).json({
                message: "Recherche relancée avec succès !",
                queriesInjected: approvedQueries.length
            });

        } catch (error) {
            Logger.log(`❌ Erreur resumeResearch: ${error.message}`);
            res.status(500).json({ error: "Erreur lors de la relance du projet." });
        }
    };
}

module.exports = ResearchController;