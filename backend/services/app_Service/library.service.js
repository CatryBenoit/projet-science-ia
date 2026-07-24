const fs = require('fs').promises;
const ArticleModel = require('../../models/article.model');
const AiReaderService = require('../IA_service/ai-reader.service');

class LibraryService {
    
    static async getAllArticles() {
        return await ArticleModel.getAllArticles();
    }

    static async getArticlesByProject(projectId) {
        return await ArticleModel.getArticlesByProjectId(projectId);
    }

    static async getArticleContent(articleId) {
        const article = await ArticleModel.getArticleById(articleId);
        
        if (!article || !article.local_file_path) {
            throw new Error("Article introuvable dans la base de données.");
        }

        try {
            // Lecture du fichier texte sur le disque dur
            return await fs.readFile(article.local_file_path, 'utf8');
        } catch (error) {
            throw new Error("Impossible de lire le fichier texte sur le disque dur.");
        }
    }

    static async analyzeArticle(articleId) {
        const article = await ArticleModel.getArticleById(articleId);
        
        if (!article || !article.local_file_path) {
            throw new Error("Article introuvable.");
        }

        // 1. Lancer l'IA sur le fichier local
        const analysis = await AiReaderService.analyzeArticle(article.local_file_path);
        
        // 2. Sauvegarder le résultat via le Modèle existant
        await ArticleModel.saveAnalysis({
            article_id: articleId,
            metadata: JSON.stringify(analysis.meta), // Sécurité : on s'assure que c'est une string JSON
            notes: analysis.notes,
            synthesis: analysis.synthesis
        });

        return analysis;
    }

    static async getArticleAnalysis(articleId) {
        const analysis = await ArticleModel.getArticleAnalysis(articleId);
        if (!analysis) {
            throw new Error("L'IA n'a pas encore analysé cet article.");
        }
        return analysis;
    }
}

module.exports = LibraryService;