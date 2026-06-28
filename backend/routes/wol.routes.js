const express = require('express');
const wol = require('wake_on_lan');
const ping = require('ping');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

router.get('/status', requireAuth, async (req, res) => {
    try {
        const targetIp = process.env.TARGET_IP;
        let result = await ping.promise.probe(targetIp, { timeout: 2 });
        res.json({ isOnline: result.alive });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors du ping" });
    }
});

router.post('/wake', requireAuth, (req, res) => {
    const macAddress = process.env.MAC_ADDRESS;
    wol.wake(macAddress, (error) => {
        if (error) {
            return res.status(500).json({ error: "Erreur lors de l'envoi du paquet magique." });
        }
        res.json({ message: "Signal Wake-on-LAN envoyé !" });
    });
});

module.exports = router;