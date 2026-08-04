const ProjectService = require('../services/app_Service/project.service');
const ProjectModel = require('../Models/project.model');
const Logger = require('../services/app_Service/logger.service');
const AiReaderService = require('../services/IA_service/ai-reader.service'); 

class ProjectController {
static async createProject(req, res) {
        const { name, description, core_theme } = req.body;
        // On récupère l'ID de l'utilisateur connecté via la session
        const userId = req.session.userId; 
        const db = require('../config/db');

        if (!name) {
            return res.status(400).json({ error: "Le nom du projet est requis." });
        }

        db.run(
            `INSERT INTO projects (name, description, core_theme) VALUES (?, ?, ?)`,
            [name, description, core_theme],
            function (err) {
                if (err) {
                    console.error("Erreur createProject:", err);
                    return res.status(500).json({ error: "Erreur lors de la création du projet." });
                }
                
                const projectId = this.lastID; // L'ID du projet tout juste créé

                // 🎯 SÉCURITÉ : On ajoute immédiatement le créateur comme "admin" de ce projet
                db.run(
                    `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')`,
                    [projectId, userId],
                    function(errMember) {
                        if (errMember) {
                            console.error("Erreur liaison créateur/projet:", errMember);
                        }
                        res.status(201).json({ id: projectId, name, description, core_theme });
                    }
                );
            }
        );
    }

    static async getProjects(req, res) {
        const userId = req.session.userId;
        const db = require('../config/db');

        // 🎯 SÉCURITÉ : On fait une jointure (JOIN) pour ne prendre que les projets où l'utilisateur est membre
        const query = `
            SELECT p.*, pm.role as my_role 
            FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = ?
            ORDER BY p.created_at DESC
        `;

        db.all(query, [userId], (err, rows) => {
            if (err) {
                console.error("Erreur getProjects:", err);
                return res.status(500).json({ error: "Erreur lors de la récupération des projets." });
            }
            res.json(rows);
        });
    }

static async generateSynthesis(req, res) {
        try {
            // 🎯 1. On récupère la directive envoyée par le Front
            const { guidance } = req.body; 

            // 🎯 2. On la transmet au service (en 2ème paramètre)
            const report = await ProjectService.generateManualSynthesis(req.params.id, guidance); 
            
            res.json({ success: true, report });
        } catch (error) {
            console.error("🚨 CRASH DANS generateSynthesis :", error);
            res.status(500).json({ error: error.message || "Échec de la génération." });
        }
    }

    static async getSynthesis(req, res) {
        try {
            const data = await ProjectService.getSynthesisContext(req.params.id);
            res.json(data);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

static async addChart(req, res) {
        const projectId = req.params.id;
        const { title, chart_type, chart_data } = req.body;
        const db = require('../config/db');

        if (!title || !chart_data) return res.status(400).json({ error: "Titre et données requis." });

        db.run(
            `INSERT INTO project_charts (project_id, title, chart_type, chart_data) VALUES (?, ?, ?, ?)`,
            [projectId, title, chart_type, JSON.stringify(chart_data)],
            function(err) {
                if (err) return res.status(500).json({ error: "Erreur lors de la sauvegarde du graphique." });
                res.status(201).json({ id: this.lastID, message: "Graphique sauvegardé avec succès." });
            }
        );
    }

static async getCharts(req, res) {
        const projectId = req.params.id;
        const db = require('../config/db');

        db.all(`SELECT * FROM project_charts WHERE project_id = ?`, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Erreur lors de la récupération des graphiques." });
            
            // On parse les données JSON qui sont stockées en texte dans SQLite
            const charts = rows.map(row => ({
                ...row,
                chart_data: JSON.parse(row.chart_data || '[]')
            }));
            res.json(charts);
        });
    }

    static async pruneTopic(req, res) {
        try {
            const ignored = await ProjectService.pruneTopic(req.params.id, req.body.topic);
            res.json({ success: true, ignored_topics: ignored });
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de l'élagage" });
        }
    }

    static async getGraph(req, res) {
        try {
            const graphData = await ProjectService.getGraphData(req.params.id);
            res.json(graphData);
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de la génération du graphe." });
        }
    }

    static getProjectById = async (req, res) => {
        try {
            const projectId = req.params.id;
            const project = await ProjectModel.getProjectWithSynthesis(projectId);
            
            if (!project) {
                return res.status(404).json({ error: "Projet introuvable." });
            }

            res.status(200).json(project);
        } catch (error) {
            Logger.log(`❌ Erreur getProjectById: ${error.message}`);
            res.status(500).json({ error: "Erreur lors de la récupération du projet." });
        }
    };

    static getPendingQueries = async (req, res) => {
        try {
            const projectId = req.params.id;
            const pendingQueries = await ProjectModel.getPendingQueries(projectId);
            res.status(200).json(pendingQueries || []);
        } catch (error) {
            Logger.log(`❌ Erreur getPendingQueries: ${error.message}`);
            res.status(500).json({ error: "Erreur lors de la récupération des requêtes en attente." });
        }
    };

    static getGraphData = async (req, res) => {
        try {
            const projectId = req.params.id;
            
            // On récupère les 3 niveaux de données
            const project = await ProjectModel.getProjectInfo(projectId);
            const articles = await ProjectModel.getAnalyzedArticles(projectId);
            const pendingQueries = await ProjectModel.getPendingQueries(projectId);

            res.status(200).json({ 
                project: project || { core_theme: "Projet" }, 
                articles: articles || [], 
                pending: pendingQueries || [] 
            });
        } catch (error) {
            console.error("Erreur Graphe:", error);
            res.status(500).json({ error: "Erreur lors de la génération du graphe" });
        }
    };





    // 💬 Le Chatbot RAG (Discuter avec les PDFs)
    static askChatbot = async (req, res) => {
        try {
            const projectId = req.params.id;
            const userId = req.user?.id || req.userId || 1;
            const { question } = req.body;

            if (!question) {
                return res.status(400).json({ error: "La question est requise." });
            }

            // 1. Récupération des articles du projet depuis la base de données
            const articles = await ProjectModel.getAnalyzedArticles(projectId);

            if (!articles || articles.length === 0) {
                return res.status(200).json({ answer: "Je n'ai pas encore d'articles analysés dans ce projet pour vous répondre. Veuillez importer des PDFs." });
            }

            // 2. Création du "Contexte" (La mémoire de l'IA)
            let context = "CONTEXTE DES ARTICLES DU PROJET :\n\n";
            articles.forEach((art) => {
                context += `--- Article: ${art.title} ---\n`;
                context += `${art.synthesis || 'Résumé non disponible.'}\n\n`;
            });
            
            // On limite la taille pour ne pas faire exploser la limite de tokens de l'API (environ 80 000 caractères)
            context = context.substring(0, 80000);

            // 3. Construction des Prompts stricts
            const systemPrompt = `Tu es un assistant de recherche scientifique expert. Ta mission est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur le contexte fourni. 
RÈGLES ABSOLUES :
1. Ne cherche pas sur internet, n'invente rien (pas d'hallucination).
2. Si la réponse n'est pas dans le contexte, dis simplement : "Je ne trouve pas cette information dans les documents du projet."
3. Cite tes sources en utilisant le titre des articles.
4. Formate ta réponse proprement en Markdown.`;

            const userPrompt = `${context}\n\nQUESTION DE L'UTILISATEUR : ${question}`;

            // 4. Appel à ton nouveau moteur IA (On utilise le rôle "synthesis" qui est souvent le modèle le plus intelligent)
            const answer = await AiReaderService.askAI(userId, 'synthesis', userPrompt, systemPrompt);

            res.status(200).json({ answer });
        } catch (error) {
            console.error("❌ Erreur Chatbot RAG:", error);
            res.status(500).json({ error: "Erreur lors de la communication avec l'IA." });
        }
    };

static async getProjectMembers(req, res) {
        const projectId = req.params.id;
        const db = require('../config/db');

        const query = `
            SELECT u.id, u.username, pm.role 
            FROM users u 
            JOIN project_members pm ON u.id = pm.user_id 
            WHERE pm.project_id = ?
        `;

        db.all(query, [projectId], (err, rows) => {
            if (err) {
                console.error("Erreur getProjectMembers:", err);
                return res.status(500).json({ error: "Impossible de récupérer les membres." });
            }
            res.json(rows);
        });
    }

    // ➕ Ajouter un membre au projet
    static async addProjectMember(req, res) {
        const projectId = req.params.id;
        const { userId, role } = req.body; // role: 'admin' ou 'member'
        const db = require('../config/db');

        if (!userId) {
            return res.status(400).json({ error: "L'ID de l'utilisateur est requis." });
        }

        db.run(
            `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
            [projectId, userId, role || 'member'],
            function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        return res.status(400).json({ error: "Cet utilisateur est déjà dans le projet." });
                    }
                    console.error("Erreur addProjectMember:", err);
                    return res.status(500).json({ error: "Erreur lors de l'ajout du membre." });
                }
                res.status(201).json({ message: "Membre ajouté au projet avec succès." });
            }
        );
    }

    // 🗑️ Retirer un membre du projet
    static async removeProjectMember(req, res) {
        const projectId = req.params.id;
        const userId = req.params.userId;
        const db = require('../config/db');

        db.run(
            `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
            [projectId, userId],
            function(err) {
                if (err) {
                    console.error("Erreur removeProjectMember:", err);
                    return res.status(500).json({ error: "Erreur lors de la suppression du membre." });
                }
                res.json({ message: "Membre retiré du projet." });
            }
        );
    }

    static async getAvailableUsers(req, res) {
        const db = require('../config/db');
        db.all(`SELECT id, username FROM users`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
            res.json(rows);
        });
    }

    static async getProjectNotes(req, res) {
        const projectId = req.params.id;
        const db = require('../config/db');

        // On joint la table users pour récupérer le nom de celui qui a posté la note
        const query = `
            SELECT n.*, u.username 
            FROM project_notes n 
            JOIN users u ON n.user_id = u.id 
            WHERE n.project_id = ? 
            ORDER BY n.created_at ASC
        `;

        db.all(query, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Erreur lors de la récupération des notes." });
            res.json(rows);
        });
    }

    // ✍️ Ajouter une note
    static async addProjectNote(req, res) {
        const projectId = req.params.id;
        const userId = req.session.userId; // On identifie l'auteur grâce à sa session
        const { content } = req.body;
        const db = require('../config/db');

        if (!content) return res.status(400).json({ error: "Le contenu de la note est vide." });

        db.run(
            `INSERT INTO project_notes (project_id, user_id, content) VALUES (?, ?, ?)`,
            [projectId, userId, content],
            function(err) {
                if (err) return res.status(500).json({ error: "Erreur lors de l'ajout de la note." });
                res.status(201).json({ id: this.lastID, message: "Note ajoutée." });
            }
        );
    }

    static async getProjectStats(req, res) {
        const projectId = req.params.id;
        const db = require('../config/db');

        // On récupère les thèmes des articles liés à ce projet
        const query = `
            SELECT aa.macro_theme, aa.micro_themes 
            FROM article_analysis aa
            JOIN articles a ON aa.article_id = a.id
            WHERE a.project_id = ?
        `;

        db.all(query, [projectId], (err, rows) => {
            if (err) {
                console.error("Erreur getProjectStats:", err);
                return res.status(500).json({ error: "Impossible de générer les statistiques." });
            }

            const macroStats = {};
            const microStats = {};

            rows.forEach(row => {
                // 1. Comptage des Macro-thèmes
                const macro = row.macro_theme || 'Non catégorisé';
                macroStats[macro] = (macroStats[macro] || 0) + 1;

                // 2. Comptage des Micro-thèmes (Mots-clés)
                try {
                    const micros = JSON.parse(row.micro_themes || '[]');
                    micros.forEach(m => {
                        // On uniformise en mettant tout en minuscules
                        const cleanWord = m.toLowerCase().trim();
                        if (cleanWord) {
                            microStats[cleanWord] = (microStats[cleanWord] || 0) + 1;
                        }
                    });
                } catch (parseErr) {
                    // Si le JSON est mal formaté par l'IA, on ignore
                }
            });

            // On trie les micro-thèmes pour ne garder que les 30 plus fréquents (pour le nuage de mots)
            const sortedMicro = Object.entries(microStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30);

            res.json({ 
                macro: macroStats, 
                micro: Object.fromEntries(sortedMicro),
                totalArticles: rows.length
            });
        });
    }


}

module.exports = ProjectController;