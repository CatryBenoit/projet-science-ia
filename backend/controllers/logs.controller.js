const Logger = require('../services/app_Service/logger.service');

class LogsController {
    /**
     * Ouvre un flux Server-Sent Events (SSE) pour streamer les logs en direct au Frontend
     */
    static streamLogs(req, res) {
        // 1. Configuration des headers pour maintenir la connexion ouverte
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Ouvre le flux

        // 2. Fonction callback qui s'active à chaque nouvel événement 'new_log'
        const sendLog = (message) => {
            // Format spécifique au SSE : "data: ... \n\n"
            res.write(`data: ${JSON.stringify({ text: message })}\n\n`);
        };

        // 3. On branche l'écouteur sur le service Logger
        Logger.on('new_log', sendLog);

        // 4. Si l'utilisateur quitte la page web, on coupe proprement la connexion pour éviter les fuites de mémoire
        req.on('close', () => {
            Logger.removeListener('new_log', sendLog);
        });
    }
}

module.exports = LogsController;