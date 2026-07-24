const LibraryService = require('../services/app_Service/library.service');

class LibraryController {
    
    static async getArticles(req, res) {
        try {
            const articles = await LibraryService.getAllArticles();
            res.json(articles);
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de la récupération de la bibliothèque." });
        }
    }

    static async getProjectArticles(req, res) {
        try {
            const { projectId } = req.params;
            const articles = await LibraryService.getArticlesByProject(projectId);
            res.json(articles);
        } catch (error) {
            res.status(500).json({ error: "Erreur BDD" });
        }
    }

    static async getArticleContent(req, res) {
        try {
            const { id } = req.params;
            const content = await LibraryService.getArticleContent(id);
            res.json({ content });
        } catch (error) {
            const status = error.message.includes("introuvable") ? 404 : 500;
            res.status(status).json({ error: error.message });
        }
    }

    static async analyzeArticle(req, res) {
        try {
            const { id } = req.params;
            const analysis = await LibraryService.analyzeArticle(id);
            res.json({ message: "Analyse terminée !", analysis });
        } catch (error) {
            const status = error.message.includes("introuvable") ? 404 : 500;
            res.status(status).json({ error: error.message === "Article introuvable." ? error.message : "Échec de l'analyse IA." });
        }
    }

    static async getArticleAnalysis(req, res) {
        try {
            const { id } = req.params;
            const analysis = await LibraryService.getArticleAnalysis(id);
            res.json(analysis);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = LibraryController;