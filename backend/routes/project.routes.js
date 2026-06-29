const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();
const Logger = require('../services/logger.service');

// 1. CRÉER un nouveau projet
router.post('/', requireAuth, (req, res) => {
    const { name, description } = req.body;
    
    // SÉCURITÉ : On gère req.user.id, req.userId, ou on bascule sur 1 (Admin) par défaut
    const userId = req.user?.id || req.userId || 1;

    if (!name) return res.status(400).json({ error: "Le nom du projet est requis." });

    db.run(`INSERT INTO projects (name, description) VALUES (?, ?)`, [name, description], function(err) {
        if (err) return res.status(500).json({ error: "Erreur lors de la création du projet." });
        
        const projectId = this.lastID;

        db.run(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')`, [projectId, userId], (err2) => {
            if (err2) return res.status(500).json({ error: "Erreur lors de l'assignation du projet." });
            
            res.status(201).json({ 
                id: projectId, 
                name, 
                description, 
                message: "Projet créé avec succès !" 
            });
        });
    });
});

// 2. RÉCUPÉRER la liste des projets de l'utilisateur
router.get('/', requireAuth, (req, res) => {
    // SÉCURITÉ : Même protection ici
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

const AiReaderService = require('../services/ai-reader.service');

router.post('/:id/synthesis', requireAuth, async (req, res) => {
    const projectId = req.params.id;
    const nemotronModel = "nemotron-3-ultra-550b"; // Modèle de raisonnement ultime de ta liste

    Logger.log(`\n👑 [Nemotron Ultra] Lancement de la Synthèse Transversale pour le projet #${projectId}...`);

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

        // Agrégation des résumés pour Nemotron
        let aggregatedData = rows.map((row, index) => {
            return `### ÉTUDE ${index + 1} : ${row.title}\n${row.synthesis}\n`;
        }).join('\n');

        // Sécurité Context Window
        if (aggregatedData.length > 60000) {
            aggregatedData = aggregatedData.substring(0, 60000) + "\n\n[... Données tronquées pour éviter la surcharge du modèle ...]";
        }

        try {
            const systemPrompt = `Tu es le Directeur de Recherche Scientifique Principal. Ton rôle est de concevoir une méta-analyse et une synthèse transversale de niveau universitaire à partir de résumés d'études.
Tu dois adopter un ton académique, ultra-critique et analytique. Ton rapport final doit obligatoirement être structuré en Markdown avec les sections suivantes :
1. 🔬 INTRODUCTION & CONTEXTE GLOBAL
2. 🤝 CONSENSUS SCIENTIFIQUE (Ce sur quoi la majorité des études s'accordent, avec statistiques agrégées s'il y en a)
3. ⚔️ DIVERGENCES, CONTRADICTIONS & LIMITES (Mets en évidence les études qui se contredisent au niveau des résultats ou des méthodes, ex: CNN vs ViT)
4. 🔍 LACUNES DE LA LITTÉRATURE & OPPORTUNITÉS (Identifie ce qui n'a JAMAIS été testé, les populations oubliées ou les angles morts)
5. 🚀 HYPOTHÈSES DE RECHERCHE FUTURES (Propose de nouvelles pistes innovantes pour le chercheur)`;

            const userPrompt = `Voici les analyses condensées de ${rows.length} publications scientifiques sur notre thème d'étude.\n\n${aggregatedData}\n\nRédige la synthèse transversale stratégique dès maintenant.`;

            // Appel à l'arme lourde : Nemotron 3 Ultra
            const finalReport = await AiReaderService.askAI(userPrompt, systemPrompt, nemotronModel);

            // Sauvegarde dans la base de données
            db.run(
                `INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`, 
                [projectId, finalReport],
                (insertErr) => {
                    if (insertErr) console.error("Erreur sauvegarde synthèse projet:", insertErr);
                    
                    res.json({ 
                        message: "Rapport de synthèse globale rédigé avec succès par l'IA !", 
                        article_count: rows.length,
                        report: finalReport 
                    });
                }
            );

        } catch (aiError) {
            console.error("Erreur critique d'analyse transversale :", aiError);
            res.status(500).json({ error: "Nemotron Ultra a rencontré une erreur lors de la génération du rapport." });
        }
    });
});

router.get('/:id/synthesis', requireAuth, (req, res) => {
    const projectId = req.params.id;
    db.get("SELECT report FROM project_synthesis WHERE project_id = ?", [projectId], (err, row) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la récupération du rapport." });
        res.json({ report: row ? row.report : null });
    });
});



module.exports = router;