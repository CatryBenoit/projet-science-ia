const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, '../users.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur ouverture DB:', err.message);
    } else {
        console.log('Connecté à la base SQLite.');
        
        // OPTIMISATION ANTI-CRASH (SQLITE_BUSY)
        // Si la base est verrouillée par une autre écriture, attends jusqu'à 5 secondes au lieu de planter
        db.configure("busyTimeout", 5000); 

        // Optimisation des performances d'écriture de SQLite (Mode WAL)
        db.run('PRAGMA journal_mode = WAL;');
        
        // On active les clés étrangères pour SQLite (important pour les liaisons ON DELETE CASCADE)
        db.run('PRAGMA foreign_keys = ON;');
    }
}); // <-- L'accolade manquante était ici !

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
    name TEXT,
    description TEXT,   -- 🛑 LA COLONNE MANQUANTE EST LÀ !
    core_theme TEXT,
    ignored_topics TEXT,
    report TEXT,
    status TEXT DEFAULT 'IN_PROGRESS',
    copilot_mode INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS pending_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    query TEXT,
    source TEXT DEFAULT 'AI',       -- 'AI' (proposé par la machine) ou 'MANUAL' (ajouté par l'humain)
    status TEXT DEFAULT 'PENDING',  -- 'PENDING' (en attente), 'APPROVED' (validé), 'REJECTED' (rejeté)
    depth INTEGER,                  -- Niveau d'itération actuel
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
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
        type TEXT DEFAULT 'academic',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);

    // 5. Table d'Analyse des Articles
db.run(`CREATE TABLE IF NOT EXISTS article_analysis (
        article_id TEXT PRIMARY KEY,
        metadata TEXT,
        macro_theme TEXT DEFAULT 'Général',
        micro_themes TEXT DEFAULT '[]',     
        notes TEXT,
        synthesis TEXT,
        conflict_of_interest TEXT, 
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    )`);

    // 6. Table de Synthèse des Projets
    db.run(`CREATE TABLE IF NOT EXISTS project_synthesis (
        project_id INTEGER PRIMARY KEY,
        report TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);


db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_key TEXT,
        ai_model TEXT DEFAULT 'meta-llama/llama-3.1-70b-instruct',
        api_base_url TEXT DEFAULT 'https://integrate.api.nvidia.com/v1',
        max_iterations INTEGER DEFAULT 2
    )`);


        db.run(`CREATE TABLE IF NOT EXISTS project_charts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        title TEXT,
        chart_type TEXT,
        chart_data TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);


    // 7. Création de l'admin par défaut
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