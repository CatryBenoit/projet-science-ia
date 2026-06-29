const express = require('express');
const Logger = require('../services/logger.service');
const router = express.Router();

// Route spéciale SSE (Server-Sent Events)
router.get('/stream', (req, res) => {
    // 1. On configure les headers pour dire au navigateur de ne jamais fermer la connexion
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Ouvre le flux

    // 2. Fonction qui s'active à chaque nouveau log
    const sendLog = (message) => {
        // Format spécifique au SSE : "data: ... \n\n"
        res.write(`data: ${JSON.stringify({ text: message })}\n\n`);
    };

    // On branche le haut-parleur
    Logger.on('new_log', sendLog);

    // 3. Si l'utilisateur quitte la page web, on coupe proprement la connexion
    req.on('close', () => {
        Logger.removeListener('new_log', sendLog);
    });
});

module.exports = router;