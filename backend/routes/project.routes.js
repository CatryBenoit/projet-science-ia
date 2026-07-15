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
router.post('/:id/synthesis', requireAuth, (req, res) => {
    const projectId = req.params.id;

    // On récupère le projet et toutes ses analyses classées
    const query = `
        SELECT p.name, p.core_theme, a.title, aa.macro_theme, aa.micro_themes, aa.synthesis
        FROM projects p
        JOIN articles a ON p.id = a.project_id
        JOIN article_analysis aa ON a.id = aa.article_id
        WHERE p.id = ?
        ORDER BY aa.macro_theme ASC
    `;

    db.all(query, [projectId], async (err, rows) => {
        if (err || !rows || rows.length === 0) {
            return res.status(400).json({ error: "Aucun article analysé pour ce projet." });
        }

        const projectName = rows[0].name;
        const coreTheme = rows[0].core_theme || projectName;

        // 🛑 REGROUPEMENT PAR MACRO-THÈME (Clustering Sémantique)
        const groupedByTheme = {};
        rows.forEach(r => {
            const theme = r.macro_theme || "Autres aspects";
            if (!groupedByTheme[theme]) groupedByTheme[theme] = [];
            groupedByTheme[theme].push(`- **${r.title}** (Sous-thèmes: ${JSON.parse(r.micro_themes || '[]').join(', ')})\n  Résumé : ${r.synthesis}`);
        });

        // Construction d'un contexte propre, trié par chapitres
        let structuredContext = "";
        for (const [theme, articles] of Object.entries(groupedByTheme)) {
            structuredContext += `\n### CATÉGORIE : ${theme.toUpperCase()}\n${articles.join('\n\n')}\n`;
        }

        const systemPrompt = `Tu es un directeur de recherche scientifique. Ton rôle est de rédiger une synthèse globale exhaustive sur le sujet : "${coreTheme}".
RÈGLES DE RÉDACTION :
1. Structure obligatoirement ton rapport en reprenant les GRANDES CATÉGORIES fournies dans le contexte.
2. Ne dérive jamais du sujet principal "${coreTheme}".
3. Fais des synthèses croisées entre les articles d'une même catégorie.
4. Utilise un format professionnel en Markdown (titres #, ##, puces, gras).`;

        const prompt = `Voici les analyses des articles classées par catégories thématiques :
${structuredContext}

Rédige le rapport complet maintenant.`;

        try {
            const report = await AiReaderService.askAI(prompt, systemPrompt);
            
            // Sauvegarde de la synthèse dans la BDD
            db.run(`UPDATE projects SET synthesis_report = ? WHERE id = ?`, [report, projectId]);
            res.json({ success: true, report });
        } catch (aiErr) {
            res.status(500).json({ error: "Échec de la génération de la synthèse structurée." });
        }
    });
});

// 4. RÉCUPÉRER LA SYNTHÈSE POUR L'AFFICHAGE FRONTEND
router.get('/:id/synthesis', requireAuth, (req, res) => {
    const projectId = req.params.id;

    // On récupère le rapport ET le contexte actuel du projet (thèmes ignorés, thème ancre)
    // Cela permet au Frontend de savoir si la synthèse est "à jour" ou obsolète
    const query = `
        SELECT 
            p.core_theme, 
            p.ignored_topics, 
            ps.report, 
            ps.created_at as generated_at
        FROM projects p
        LEFT JOIN project_synthesis ps ON p.id = ps.project_id
        WHERE p.id = ?
    `;

    db.get(query, [projectId], (err, row) => {
        if (err) {
            console.error("Erreur récupération synthèse:", err);
            return res.status(500).json({ error: "Erreur lors de la récupération du rapport." });
        }

        if (!row) {
            return res.status(404).json({ error: "Projet introuvable." });
        }

        // On renvoie un objet complet pour que le Frontend puisse l'exploiter
        res.json({
            report: row.report || null,
            context: {
                core_theme: row.core_theme || "Non défini",
                ignored_topics: JSON.parse(row.ignored_topics || '[]'),
                generated_at: row.generated_at
            }
        });
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

// --- GRAPHE SÉMANTIQUE & ÉLAGAGE ---

// Récupérer les nœuds et liens du graphe pour un projet
router.get('/:id/graph', requireAuth, (req, res) => {
    const projectId = req.params.id;

    // 1. Récupérer le projet
    db.get("SELECT name, core_theme, ignored_topics FROM projects WHERE id = ?", [projectId], (err, project) => {
        if (err || !project) return res.status(404).json({ error: "Projet introuvable" });

        const ignored = JSON.parse(project.ignored_topics || '[]');

        // 2. Récupérer les articles analysés
        const query = `
            SELECT a.id, a.title, aa.macro_theme, aa.micro_themes 
            FROM articles a 
            JOIN article_analysis aa ON a.id = aa.article_id 
            WHERE a.project_id = ?
        `;

        db.all(query, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Erreur BDD" });

            const nodes = [];
            const edges = [];

            // NŒUD RACINE : Le Projet / Thème Ancre
            nodes.push({
                id: 'root',
                type: 'input',
                data: { label: `🎯 ${project.core_theme || project.name}` },
                position: { x: 50, y: 250 },
                style: { background: 'var(--primary)', color: '#fff', fontWeight: 'bold', border: '2px solid #fff', borderRadius: '8px', padding: '10px' }
            });

            // Regroupement par Macro-Thèmes pour créer les branches
            const themesMap = {};
            rows.forEach(row => {
                const theme = row.macro_theme || "Général";
                // On ignore les thèmes bannis par l'utilisateur !
                if (!ignored.includes(theme.toLowerCase())) {
                    if (!themesMap[theme]) themesMap[theme] = [];
                    themesMap[theme].push(row);
                }
            });

            let themeIndex = 0;
            let articleGlobalIndex = 0;

            for (const [theme, articles] of Object.entries(themesMap)) {
                const themeNodeId = `theme_${themeIndex}`;
                
                // NŒUD NIVEAU 1 : Le Macro-Thème
                nodes.push({
                    id: themeNodeId,
                    data: { label: `🏷️ ${theme}`, themeName: theme, type: 'theme' },
                    position: { x: 350, y: themeIndex * 160 + 50 },
                    style: { background: 'var(--bg-panel)', color: 'var(--text-main)', border: '2px solid var(--success)', borderRadius: '8px', fontWeight: 'bold' }
                });

                // LIEN : Racine -> Thème
                edges.push({
                    id: `edge_root_${themeNodeId}`,
                    source: 'root',
                    target: themeNodeId,
                    animated: true,
                    style: { stroke: 'var(--success)', strokeWidth: 2 }
                });

                // NŒUDS NIVEAU 2 : Les Articles liés à ce thème
                articles.forEach((art, aIndex) => {
                    const artNodeId = `art_${art.id}`;
                    nodes.push({
                        id: artNodeId,
                        data: { label: `📄 ${art.title.substring(0, 25)}...`, fullTitle: art.title, type: 'article' },
                        position: { x: 680, y: articleGlobalIndex * 80 + 20 },
                        style: { background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '11px', width: 180 }
                    });

                    // LIEN : Thème -> Article
                    edges.push({
                        id: `edge_${themeNodeId}_${artNodeId}`,
                        source: themeNodeId,
                        target: artNodeId,
                        style: { stroke: 'var(--border)' }
                    });

                    articleGlobalIndex++;
                });

                themeIndex++;
            }

            res.json({ nodes, edges, ignored_topics: ignored });
        });
    });
});

// Bannir (élaguer) ou réhabiliter un thème
router.post('/:id/prune', requireAuth, (req, res) => {
    const { topic } = req.body;
    const projectId = req.params.id;

    db.get("SELECT ignored_topics FROM projects WHERE id = ?", [projectId], (err, row) => {
        if (err || !row) return res.status(500).json({ error: "Erreur BDD" });
        
        let ignored = JSON.parse(row.ignored_topics || '[]');
        const cleanTopic = topic.toLowerCase().trim();

        if (!ignored.includes(cleanTopic)) {
            ignored.push(cleanTopic); // On ajoute aux bannis
        }

        db.run("UPDATE projects SET ignored_topics = ? WHERE id = ?", [JSON.stringify(ignored), projectId], (err2) => {
            if (err2) return res.status(500).json({ error: "Erreur lors de l'élagage" });
            res.json({ success: true, ignored_topics: ignored });
        });
    });
});



module.exports = router;