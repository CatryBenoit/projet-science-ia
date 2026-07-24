const ProjectModel = require('../../models/project.model');
const AiReaderService = require('../IA_service/ai-reader.service');

class ProjectService {
    
    static async createProject(userId, name, description) {
        const projectId = await ProjectModel.createProject(name, description);
        await ProjectModel.assignOwner(projectId, userId);
        return { id: projectId, name, description };
    }

    static async getUserProjects(userId) {
        return await ProjectModel.getUserProjects(userId);
    }

    static async generateManualSynthesis(projectId) {
        const project = await ProjectModel.getProjectInfo(projectId);
        const rows = await ProjectModel.getAnalyzedArticles(projectId);

        if (!rows || rows.length === 0) {
            throw new Error("Aucun article analysé pour ce projet.");
        }

        const coreTheme = project.core_theme || project.name;

        // Regroupement par Macro-Thèmes (Clustering)
        const groupedByTheme = {};
        rows.forEach(r => {
            const theme = r.macro_theme || "Autres aspects";
            if (!groupedByTheme[theme]) groupedByTheme[theme] = [];
            groupedByTheme[theme].push(`- **${r.title}** (Sous-thèmes: ${JSON.parse(r.micro_themes || '[]').join(', ')})\n  Résumé : ${r.synthesis}`);
        });

        let structuredContext = "";
        for (const [theme, articles] of Object.entries(groupedByTheme)) {
            structuredContext += `\n### CATÉGORIE : ${theme.toUpperCase()}\n${articles.join('\n\n')}\n`;
        }

        const systemPrompt = `Tu es un directeur de recherche scientifique. Ton rôle est de rédiger une synthèse globale exhaustive sur le sujet : "${coreTheme}".
RÈGLES DE RÉDACTION :
1. Structure obligatoirement ton rapport en reprenant les GRANDES CATÉGORIES fournies dans le contexte.
2. Ne dérive jamais du sujet principal "${coreTheme}".
3. Fais des synthèses croisées entre les articles d'une même catégorie.
4. Utilise un format professionnel en Markdown.`;

        const prompt = `Voici les analyses des articles classées par catégories thématiques :\n${structuredContext}\nRédige le rapport complet maintenant.`;

        const report = await AiReaderService.askAI(prompt, systemPrompt);
        await ProjectModel.saveSynthesis(projectId, report);
        
        return report;
    }

    static async getSynthesisContext(projectId) {
        const row = await ProjectModel.getProjectWithSynthesis(projectId);
        if (!row) throw new Error("Projet introuvable.");

        return {
            report: row.report || null,
            context: {
                core_theme: row.core_theme || "Non défini",
                ignored_topics: JSON.parse(row.ignored_topics || '[]'),
                generated_at: row.generated_at
            }
        };
    }

    static async addChart(projectId, title, chartType, chartData) {
        return await ProjectModel.saveChart(projectId, title, chartType, JSON.stringify(chartData));
    }

    static async getCharts(projectId) {
        const rows = await ProjectModel.getCharts(projectId);
        return rows.map(row => ({ ...row, chart_data: JSON.parse(row.chart_data) }));
    }

    static async pruneTopic(projectId, topic) {
        const project = await ProjectModel.getProjectInfo(projectId);
        let ignored = JSON.parse(project.ignored_topics || '[]');
        const cleanTopic = topic.toLowerCase().trim();

        if (!ignored.includes(cleanTopic)) {
            ignored.push(cleanTopic);
        }

        await ProjectModel.updateIgnoredTopics(projectId, JSON.stringify(ignored));
        return ignored;
    }

    static async getGraphData(projectId) {
        const project = await ProjectModel.getProjectInfo(projectId);
        if (!project) throw new Error("Projet introuvable");

        const ignored = JSON.parse(project.ignored_topics || '[]');
        const rows = await ProjectModel.getAnalyzedArticles(projectId);

        const nodes = [];
        const edges = [];

        // Nœud Racine
        nodes.push({
            id: 'root',
            type: 'input',
            data: { label: `🎯 ${project.core_theme || project.name}` },
            position: { x: 50, y: 250 },
            style: { background: 'var(--primary)', color: '#fff', fontWeight: 'bold', border: '2px solid #fff', borderRadius: '8px', padding: '10px' }
        });

        const themesMap = {};
        rows.forEach(row => {
            const theme = row.macro_theme || "Général";
            if (!ignored.includes(theme.toLowerCase())) {
                if (!themesMap[theme]) themesMap[theme] = [];
                themesMap[theme].push(row);
            }
        });

        let themeIndex = 0;
        let articleGlobalIndex = 0;

        for (const [theme, articles] of Object.entries(themesMap)) {
            const themeNodeId = `theme_${themeIndex}`;
            
            nodes.push({
                id: themeNodeId,
                data: { label: `🏷️ ${theme}`, themeName: theme, type: 'theme' },
                position: { x: 350, y: themeIndex * 160 + 50 },
                style: { background: 'var(--bg-panel)', color: 'var(--text-main)', border: '2px solid var(--success)', borderRadius: '8px', fontWeight: 'bold' }
            });

            edges.push({
                id: `edge_root_${themeNodeId}`, source: 'root', target: themeNodeId, animated: true,
                style: { stroke: 'var(--success)', strokeWidth: 2 }
            });

            articles.forEach((art) => {
                const artNodeId = `art_${art.id}`;
                nodes.push({
                    id: artNodeId,
                    data: { label: `📄 ${art.title.substring(0, 25)}...`, fullTitle: art.title, type: 'article' },
                    position: { x: 680, y: articleGlobalIndex * 80 + 20 },
                    style: { background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '11px', width: 180 }
                });

                edges.push({
                    id: `edge_${themeNodeId}_${artNodeId}`, source: themeNodeId, target: artNodeId,
                    style: { stroke: 'var(--border)' }
                });

                articleGlobalIndex++;
            });
            themeIndex++;
        }

        return { nodes, edges, ignored_topics: ignored };
    }
}

module.exports = ProjectService;