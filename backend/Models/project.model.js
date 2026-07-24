// Fichier : backend/models/project.model.js
const db = require('../config/db');

class ProjectModel {
    /**
     * Récupère les articles analysés pour un projet donné
     */
    static getAnalyzedArticles(projectId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT a.title, aa.metadata, aa.synthesis 
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

    /**
     * Sauvegarde la méga-synthèse d'un projet
     */
    static saveSynthesis(projectId, report) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`;
            db.run(query, [projectId, report], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    static getProjectWithSynthesis(projectId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT p.name, p.core_theme, p.ignored_topics, ps.report 
                FROM projects p 
                LEFT JOIN project_synthesis ps ON p.id = ps.project_id 
                WHERE p.id = ?
            `;
            db.get(query, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    static createProject(name, description) {
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO projects (name, description) VALUES (?, ?)`, [name, description], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    static assignOwner(projectId, userId) {
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')`, [projectId, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static getUserProjects(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT p.id, p.name, p.description, p.created_at, pm.role 
                FROM projects p
                JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.user_id = ?
                ORDER BY p.created_at DESC
            `;
            db.all(query, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    static getProjectInfo(projectId) {
        return new Promise((resolve, reject) => {
            db.get("SELECT name, core_theme, ignored_topics FROM projects WHERE id = ?", [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // --- SYNTHÈSE ET ANALYSES ---

    static getAnalyzedArticles(projectId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT a.id, a.title, aa.metadata, aa.synthesis, aa.notes, aa.macro_theme, aa.micro_themes
                FROM articles a 
                JOIN article_analysis aa ON a.id = aa.article_id 
                WHERE a.project_id = ?
                ORDER BY aa.macro_theme ASC
            `;
            db.all(query, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    static saveSynthesis(projectId, report) {
        return new Promise((resolve, reject) => {
            db.run(`INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`, [projectId, report], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    static getProjectWithSynthesis(projectId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT p.core_theme, p.ignored_topics, ps.report, ps.created_at as generated_at
                FROM projects p
                LEFT JOIN project_synthesis ps ON p.id = ps.project_id
                WHERE p.id = ?
            `;
            db.get(query, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static updateIgnoredTopics(projectId, ignoredTopicsString) {
        return new Promise((resolve, reject) => {
            db.run("UPDATE projects SET ignored_topics = ? WHERE id = ?", [ignoredTopicsString, projectId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // --- GRAPHIQUES (DATAVIZ) ---

    static saveChart(projectId, title, chartType, chartDataString) {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO project_charts (project_id, title, chart_type, chart_data) VALUES (?, ?, ?, ?)`;
            db.run(query, [projectId, title, chartType, chartDataString], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    static getCharts(projectId) {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM project_charts WHERE project_id = ?", [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = ProjectModel;