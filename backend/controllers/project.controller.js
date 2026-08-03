const ProjectService = require('../services/app_Service/project.service');
const ProjectModel = require('../Models/project.model');
const Logger = require('../services/app_Service/logger.service');
const AiReaderService = require('../services/IA_service/ai-reader.service'); 

class ProjectController {
    static async createProject(req, res) {
        try {
            const { name, description } = req.body;
            const userId = req.user?.id || req.userId || 1;
            
            if (!name) return res.status(400).json({ error: "Le nom du projet est requis." });
            
            const project = await ProjectService.createProject(userId, name, description);
            res.status(201).json({ ...project, message: "Projet créé avec succès !" });
        } catch (error) {
            // 🚨 AJOUT CRUCIAL : Affichage de l'erreur dans le terminal
            console.error("🚨 CRASH DANS createProject :", error); 
            res.status(500).json({ error: "Erreur lors de la création du projet", detail: error.message });
        }
    }

    static async getProjects(req, res) {
        try {
            const userId = req.user?.id || req.userId || 1;
            const projects = await ProjectService.getUserProjects(userId);
            res.json(projects);
        } catch (error) {
            // 🚨 AJOUT CRUCIAL : Affichage de l'erreur dans le terminal
            console.error("🚨 CRASH DANS getProjects :", error); 
            res.status(500).json({ error: "Erreur lors de la récupération des projets.", detail: error.message });
        }
    }

    static async generateSynthesis(req, res) {
        try {
            const report = await ProjectService.generateManualSynthesis(req.params.id);
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
        try {
            const { title, chart_type, chart_data } = req.body;
            const chartId = await ProjectService.addChart(req.params.id, title, chart_type, chart_data);
            res.json({ success: true, chart_id: chartId });
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de la sauvegarde du graphique." });
        }
    }

    static async getCharts(req, res) {
        try {
            const charts = await ProjectService.getCharts(req.params.id);
            res.json(charts);
        } catch (error) {
            res.status(500).json({ error: "Erreur BDD" });
        }
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

}

module.exports = ProjectController;