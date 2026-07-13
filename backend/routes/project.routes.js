const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();
const AiReaderService = require('../services/ai-reader.service');
const Logger = require('../services/logger.service'); // <-- Ajout du Logger

// 1. CRÉER un nouveau projet
router.post('/', requireAuth, (req, res) => {
    const { name, description } = req.body;
    const userId = req.user?.id || req.userId || 1;

    if (!name) return res.status(400).json({ error: "Le nom du projet est requis." });

    db.run(`INSERT INTO projects (name, description) VALUES (?, ?)`, [name, description], function(err) {
        if (err) return res.status(500).json({ error: "Erreur lors de la création du projet." });
        const projectId = this.lastID;
        db.run(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')`, [projectId, userId], (err2) => {
            if (err2) return res.status(500).json({ error: "Erreur lors de l'assignation du projet." });
            res.status(201).json({ id: projectId, name, description, message: "Projet créé avec succès !" });
        });
    });
});

// 2. RÉCUPÉRER la liste des projets de l'utilisateur
router.get('/', requireAuth, (req, res) => {
    const userId = req.user?.id || req.userId || 1;
    const query = `
        SELECT p.id, p.name, p.description, p.created_at, pm.role 
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ?
        ORDER BY p.created_at DESC
    `;
    db.all(query, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la récupération des projets." });
        res.json(rows);
    });
});

// 3. GÉNÉRER MANUELLEMENT LA SYNTHÈSE (Forcer la génération)
router.post('/:id/synthesis', requireAuth, async (req, res) => {
    const projectId = req.params.id;
    // CORRECTION : On utilise le modèle Llama 3.1 70B qui fonctionne à 100% sur ton API
    const targetModel = "meta/llama-3.1-70b-instruct"; 

    Logger.log(`\n👑 [Mode Manuel] Lancement de la Synthèse Transversale pour le projet #${projectId}...`);

    const query = `
        SELECT a.title, aa.metadata, aa.synthesis, aa.notes 
        FROM articles a
        JOIN article_analysis aa ON a.id = aa.article_id
        WHERE a.project_id = ?
    `;

    db.all(query, [projectId], async (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: "Aucun article analysé trouvé. Lancez d'abord l'analyse sur vos articles." });
        }

        Logger.log(`📚 Fusion des données de ${rows.length} articles analysés...`);

        let aggregatedData = rows.map((row, index) => {
            return `### ÉTUDE ${index + 1} : ${row.title}\n${row.synthesis}\n`;
        }).join('\n');

        if (aggregatedData.length > 60000) {
            aggregatedData = aggregatedData.substring(0, 60000) + "\n\n[... Données tronquées ...]";
        }

        try {
            const systemPrompt = `Tu es le Directeur de Recherche Scientifique Principal. Ton rôle est de concevoir une méta-analyse et une synthèse transversale de niveau universitaire à partir de résumés d'études.
Tu dois adopter un ton académique, ultra-critique et analytique. Ton rapport final doit obligatoirement être structuré en Markdown avec les sections suivantes :
1. 🔬 INTRODUCTION & CONTEXTE GLOBAL
2. 🤝 CONSENSUS SCIENTIFIQUE
3. ⚔️ DIVERGENCES, CONTRADICTIONS & LIMITES
4. 🔍 LACUNES DE LA LITTÉRATURE & OPPORTUNITÉS
5. 🚀 HYPOTHÈSES DE RECHERCHE FUTURES`;

            const userPrompt = `Voici les analyses condensées de ${rows.length} publications scientifiques sur notre thème d'étude.\n\n${aggregatedData}\n\nRédige la synthèse transversale stratégique dès maintenant.`;

            const finalReport = await AiReaderService.askAI(userPrompt, systemPrompt, targetModel);

            db.run(
                `INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`, 
                [projectId, finalReport],
                (insertErr) => {
                    if (insertErr) console.error("Erreur sauvegarde synthèse projet:", insertErr);
                    Logger.log(`🎉 [Mode Manuel] Synthèse générée et sauvegardée avec succès !`);
                    res.json({ message: "Rapport généré avec succès !", article_count: rows.length, report: finalReport });
                }
            );

        } catch (aiError) {
            console.error("Erreur critique d'analyse transversale :", aiError);
            res.status(500).json({ error: "L'IA a rencontré une erreur lors de la génération du rapport." });
        }
    });
});

// 4. RÉCUPÉRER LA SYNTHÈSE POUR L'AFFICHAGE FRONTEND
router.get('/:id/synthesis', requireAuth, (req, res) => {
    const projectId = req.params.id;
    db.get("SELECT report FROM project_synthesis WHERE project_id = ?", [projectId], (err, row) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la récupération du rapport." });
        res.json({ report: row ? row.report : null });
    });
});

router.post('/:id/charts', requireAuth, (req, res) => {
    const { title, chart_type, chart_data } = req.body;
    const query = `INSERT INTO project_charts (project_id, title, chart_type, chart_data) VALUES (?, ?, ?, ?)`;
    
    db.run(query, [req.params.id, title, chart_type, JSON.stringify(chart_data)], function(err) {
        if (err) return res.status(500).json({ error: "Erreur lors de la sauvegarde du graphique." });
        res.json({ success: true, chart_id: this.lastID });
    });
});

// Récupérer les graphiques d'un projet
router.get('/:id/charts', requireAuth, (req, res) => {
    db.all("SELECT * FROM project_charts WHERE project_id = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        // On re-transforme le texte brut en objet JSON pour le frontend
        const charts = rows.map(row => ({
            ...row,
            chart_data: JSON.parse(row.chart_data)
        }));
        res.json(charts);
    });});

module.exports = router;