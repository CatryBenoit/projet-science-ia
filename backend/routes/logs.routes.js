const express = require('express');
const LogsController = require('../controllers/logs.controller');
const router = express.Router();

// Route spéciale SSE (Server-Sent Events) pour le Terminal Live
router.get('/stream', LogsController.streamLogs);

module.exports = router;