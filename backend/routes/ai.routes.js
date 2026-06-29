const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

// On récupère les variables du fichier .env
const API_URL = process.env.AI_API_URL;
const API_KEY = process.env.AI_API_KEY;

router.post('/ask-nvidia', requireAuth, async (req, res) => {
    const { prompt, system, model } = req.body;
    
    // Sécurité : Vérifie que la clé API est bien configurée
    if (!API_KEY) {
        return res.status(500).json({ error: "Clé API manquante dans le fichier .env du serveur." });
    }

    try {
        console.log(`🚀 Envoi de la requête au modèle cloud : ${model}...`);

        // Format standard de requête (Compatible NVIDIA NIM, OpenRouter, OpenAI, Groq, etc.)
        const response = await axios.post(API_URL, {
            model: model,
            messages: [
                { role: "system", "content": system },
                { role: "user", "content": prompt }
            ],
            temperature: 0.1, // Température très basse (0.1) pour forcer l'IA à être factuelle et scientifique !
            max_tokens: 4000  // On autorise des réponses longues pour la synthèse
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // On laisse 2 minutes à l'IA pour réfléchir (important pour Nemotron)
        });

        // Extraction de la réponse texte depuis le JSON renvoyé par l'API
        const aiResponseText = response.data.choices[0].message.content;
        
        // On renvoie la réponse à notre AiReaderService
        res.json({ response: aiResponseText });

    } catch (error) {
        // Gestion propre des erreurs (ex: crédit épuisé, mauvais nom de modèle)
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error(`❌ Erreur API IA [${model}]:`, errorMsg);
        
        res.status(500).json({ 
            error: "Échec de la communication avec l'API IA.",
            details: errorMsg
        });
    }
});

module.exports = router;