const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

// Route pour interroger l'API NVIDIA
router.post('/ask-nvidia', requireAuth, async (req, res) => {
    const { prompt, modelName } = req.body;
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "Clé API NVIDIA non configurée." });

    try {
        // Fetch natif de Node.js (v18+)
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelName || "meta/llama-3.1-8b-instruct",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) throw new Error(`Erreur NVIDIA: ${response.status}`);

        const data = await response.json();
        res.json({ reply: data.choices[0].message.content });

    } catch (error) {
        console.error("Erreur API NVIDIA:", error);
        return res.status(500).json({ error: "Impossible de contacter l'IA de NVIDIA." });
    }
});

// Future route pour interroger Ollama sur ton PC 2 local
router.post('/ask-ollama', requireAuth, async (req, res) => {
    const { prompt, modelName } = req.body;
    const ollamaUrl = process.env.OLLAMA_API_URL;

    try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName || "llama3", // Modèle installé sur ton PC 2
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) throw new Error("Le PC IA semble éteint ou Ollama ne tourne pas.");
        
        const data = await response.json();
        res.json({ reply: data.response });

    } catch (error) {
        res.status(500).json({ error: "Impossible de joindre le serveur IA local (Ollama)." });
    }
});

module.exports = router;