const AiService = require('../services/app_Service/ai.service');

class AiController {
    
    // Route : /ask-nvidia
    static async askRawAi(req, res) {
        try {
            const { prompt, system, model } = req.body;
            console.log(`🚀 Demande brute à l'IA...`);
            
            const response = await AiService.askRaw(prompt, system, model);
            res.json({ response });
        } catch (error) {
            res.status(500).json({ error: "Échec de la communication avec l'API IA.", details: error.message });
        }
    }

    // Route : /projects/:projectId/chat
    static async projectChat(req, res) {
        try {
            const { projectId } = req.params;
            const { question } = req.body;

            if (!question) return res.status(400).json({ error: "La question est requise" });

            const answer = await AiService.chatRAG(projectId, question);
            res.json({ answer });
        } catch (error) {
            console.error("Erreur Chat RAG:", error);
            res.status(500).json({ error: "Le modèle IA n'a pas pu répondre." });
        }
    }

    // Route : /projects/:projectId/dataviz
    static async projectDataviz(req, res) {
        try {
            const { projectId } = req.params;
            const { prompt } = req.body;

            if (!prompt) return res.status(400).json({ error: "Le prompt est requis" });

            const chartData = await AiService.generateDataviz(projectId, prompt);
            res.json(chartData);
        } catch (error) {
            console.error("Erreur DataViz:", error);
            res.status(500).json({ error: "L'IA n'a pas pu extraire de données numériques valides pour cette demande." });
        }
    }
}

module.exports = AiController;