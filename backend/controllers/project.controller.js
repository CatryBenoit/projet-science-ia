const ProjectService = require('../services/app_Service/project.service');
const ProjectModel = require('../Models/project.model');
const Logger = require('../services/app_Service/logger.service');

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
}

module.exports = ProjectController;