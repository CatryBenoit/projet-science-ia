const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

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

    console.log(`\n🧠 Lancement de la Synthèse Transversale pour le projet #${projectId}...`);

    // 1. Récupérer toutes les analyses liées aux articles de ce projet
    const query = `
        SELECT a.title, aa.synthesis, aa.notes 
        FROM articles a
        JOIN article_analysis aa ON a.id = aa.article_id
        WHERE a.project_id = ?
    `;

    db.all(query, [projectId], async (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la lecture de la base de données." });
        
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: "Aucun article analysé trouvé pour ce projet. Lancez l'Agent Lecteur d'abord." });
        }

        console.log(`📚 ${rows.length} articles analysés trouvés. Préparation des données...`);

        // 2. Agréger intelligemment les données pour ne pas saturer la mémoire de l'IA
        // On ne prend que le titre et la petite synthèse de chaque article.
        let aggregatedData = rows.map((row, index) => {
            return `### Étude ${index + 1} : ${row.title}\n${row.synthesis}\n`;
        }).join('\n');

        // Sécurité : si le texte est vraiment gigantesque, on le tronque un peu (ex: 50 000 caractères max)
        if (aggregatedData.length > 50000) {
            aggregatedData = aggregatedData.substring(0, 50000) + "\n\n[... Données tronquées pour éviter la surcharge cognitive de l'IA ...]";
        }

        try {
            // 3. Appeler l'IA pour le travail d'écriture
            const systemPrompt = `Tu es un Directeur de Recherche Scientifique de renommée mondiale. 
Ton rôle est de lire les résumés d'une multitude d'études sur un même sujet et d'en faire un rapport de synthèse transversal de niveau universitaire (en Markdown).
Ton rapport doit obligatoirement inclure :
1. Une Introduction (Le contexte global).
2. Les Consensus (Ce sur quoi toutes les études sont d'accord).
3. Les Divergences ou Limites (Les contradictions entre les études ou les manques).
4. Une Conclusion (Pistes pour les futures recherches).`;

            const userPrompt = `Voici les conclusions individuelles de ${rows.length} études scientifiques.\n\n${aggregatedData}\n\nRédige ton rapport de synthèse complet maintenant.`;

            const finalReport = await AiReaderService.askAI(userPrompt, systemPrompt);

            // 4. Sauvegarder la synthèse en base de données (INSERT OR REPLACE met à jour si elle existe déjà)
            db.run(
                `INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`, 
                [projectId, finalReport],
                (insertErr) => {
                    if (insertErr) {
                        console.error("Erreur de sauvegarde de la synthèse:", insertErr);
                    }
                    res.json({ 
                        message: "Synthèse générée avec succès !", 
                        article_count: rows.length,
                        report: finalReport 
                    });
                }
            );

        } catch (aiError) {
            console.error("Erreur IA lors de la synthèse :", aiError);
            res.status(500).json({ error: "L'IA a rencontré un problème lors de la rédaction du rapport." });
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