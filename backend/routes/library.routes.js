const express = require('express');
const db = require('../config/db');
const fs = require('fs').promises;
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

// 1. Récupérer la liste de tous les articles (MISE À JOUR : on ajoute le project_id dans le SELECT)
router.get('/articles', requireAuth, (req, res) => {
    // C'est ici qu'il manquait le "project_id" !
    db.all("SELECT id, title, published_date, oa_url, project_id FROM articles ORDER BY published_date DESC", [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la récupération de la bibliothèque." });
        }
        res.json(rows);
    });
});

// 2. Lire le contenu textuel d'un article spécifique
router.get('/articles/:id/content', requireAuth, (req, res) => {
    const articleId = req.params.id;

    db.get("SELECT local_file_path FROM articles WHERE id = ?", [articleId], async (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: "Article introuvable dans la base de données." });
        }

        try {
            // On lit le fichier texte sur le disque dur
            const textContent = await fs.readFile(row.local_file_path, 'utf8');
            res.json({ content: textContent });
        } catch (error) {
            res.status(500).json({ error: "Impossible de lire le fichier texte sur le disque dur." });
        }
    });
});

const AiReaderService = require('../services/ai-reader.service');

// 3. Analyser un article avec l'IA
router.post('/articles/:id/analyze', requireAuth, async (req, res) => {
    const articleId = req.params.id;

    // 1. Chercher le chemin du fichier en DB
    db.get("SELECT local_file_path FROM articles WHERE id = ?", [articleId], async (err, row) => {
        if (!row) return res.status(404).json({ error: "Article introuvable." });

        try {
            // 2. Lancer l'IA
            const analysis = await AiReaderService.analyzeArticle(row.local_file_path);
            
            // 3. Sauvegarder le résultat dans une nouvelle table 'article_analysis'
            db.run(
                `INSERT OR REPLACE INTO article_analysis (article_id, metadata, notes, synthesis) VALUES (?, ?, ?, ?)`,
                [articleId, analysis.meta, analysis.notes, analysis.synthesis]
            );

            res.json({ message: "Analyse terminée !", analysis });
        } catch (error) {
            res.status(500).json({ error: "Échec de l'analyse IA." });
        }
    });
});

module.exports = router;