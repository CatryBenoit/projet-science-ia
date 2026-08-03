require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const libraryRoutes = require('./routes/library.routes');
const authRoutes = require('./routes/auth.routes');
const wolRoutes = require('./routes/wol.routes');
const adminRoutes = require('./routes/admin.routes');
const aiRoutes = require('./routes/ai.routes');
const researchRoutes = require('./routes/research.routes');
const projectRoutes = require('./routes/project.routes');
const logsRoutes = require('./routes/logs.routes'); 
const settingsRoutes = require('./routes/settings.routes'); 
const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARES ---
// CORS permet au frontend React (ex: localhost:5173) de communiquer avec cette API
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // Très important pour que les cookies de session passent !
}));

app.use(express.json());

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Passer à true en production si tu utilises HTTPS
        httpOnly: true, // Sécurité contre les attaques XSS
        maxAge: 1000 * 60 * 60 * 24 // Session valide 24 heures
    }
}));

// --- MONTAGE DES ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/wol', wolRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);

// --- LANCEMENT DU SERVEUR ---
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Serveur Backend API démarré sur http://localhost:${port}`);
});