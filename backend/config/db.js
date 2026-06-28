const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, '../users.db');
const db = new sqlite3.Database(dbPath);

// On active les clés étrangères pour SQLite (important pour les liaisons)
db.run("PRAGMA foreign_keys = ON");

db.serialize(() => {
    // 1. Table des Utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    // 2. Table des Projets
    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. Table de liaison Projets <-> Utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER,
        user_id INTEGER,
        role TEXT DEFAULT 'member',
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 4. Table des Articles
    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT,
        published_date TEXT,
        oa_url TEXT,
        local_file_path TEXT,
        project_id INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS article_analysis (
    article_id TEXT PRIMARY KEY,
    metadata TEXT,
    notes TEXT,
    synthesis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
)`);
db.run(`CREATE TABLE IF NOT EXISTS project_synthesis (
        project_id INTEGER PRIMARY KEY,
        report TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);

    // 5. Création de l'admin par défaut
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (err) {
            console.error("Erreur de comptage utilisateurs:", err);
            return;
        }
        if (row && row.count === 0) {
            try {
                const hashedPwd = await bcrypt.hash('admin123', 10);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedPwd, 'admin']);
                console.log("✅ Administrateur par défaut créé (admin / admin123)");
            } catch (hashErr) {
                console.error("Erreur création admin:", hashErr);
            }
        }
    });
});

module.exports = db;