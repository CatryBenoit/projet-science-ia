// Fichier : backend/models/article.model.js
const db = require('../config/db');

class ArticleModel {
    /**
     * Sauvegarde ou met à jour un article dans la base
     */
    static saveArticle(data) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO articles (id, title, published_date, oa_url, local_file_path, project_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(query, [data.id, data.title, data.published_date, data.oa_url, data.local_file_path, data.project_id, data.type], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Sauvegarde l'analyse IA d'un article
     */
    static saveAnalysis(data) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO article_analysis (article_id, metadata, notes, synthesis) VALUES (?, ?, ?, ?)`;
            db.run(query, [data.article_id, data.metadata, data.notes, data.synthesis], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Récupère les articles analysés pour un projet donné
     */
    static getAnalyzedArticles(projectId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT a.title, aa.metadata, aa.synthesis, aa.notes 
                FROM articles a 
                JOIN article_analysis aa ON a.id = aa.article_id 
                WHERE a.project_id = ?
            `;
            db.all(query, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    static getAllArticles() {
        return new Promise((resolve, reject) => {
            db.all("SELECT id, title, published_date, oa_url, project_id FROM articles ORDER BY published_date DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Récupérer un article spécifique (pour trouver son chemin de fichier)
     */
    static getArticleById(id) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM articles WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Récupérer tous les articles d'un projet
     */
    static getArticlesByProjectId(projectId) {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM articles WHERE project_id = ? ORDER BY published_date DESC", [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Récupérer l'analyse IA d'un article
     */
    static getArticleAnalysis(articleId) {
        return new Promise((resolve, reject) => {
            db.get("SELECT metadata, notes, synthesis FROM article_analysis WHERE article_id = ?", [articleId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

module.exports = ArticleModel;