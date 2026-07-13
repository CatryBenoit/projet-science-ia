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

const db = require('../config/db');
const AiReaderService = require('../services/ai-reader.service');

// Route RAG : Poser une question sur un projet spécifique
router.post('/projects/:projectId/chat', requireAuth, (req, res) => {
    const { projectId } = req.params;
    const { question } = req.body;

    if (!question) return res.status(400).json({ error: "La question est requise" });

    // 1. On rassemble TOUTES les analyses du projet pour créer le "Contexte"
    const query = `
        SELECT a.title, aa.synthesis, aa.notes 
        FROM articles a 
        JOIN article_analysis aa ON a.id = aa.article_id 
        WHERE a.project_id = ?
    `;

    db.all(query, [projectId], async (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        if (!rows || rows.length === 0) {
            return res.json({ answer: "Je n'ai pas encore lu d'articles pour ce projet. Lancez d'abord une recherche." });
        }

        // 2. Construction du contexte RAG (On limite la taille pour ne pas exploser les tokens)
        let context = rows.map((r, i) => `[Source ${i+1}: ${r.title}]\nSynthèse: ${r.synthesis}\n`).join('\n\n');
        if (context.length > 50000) context = context.substring(0, 50000) + "\n...[Contexte tronqué]...";

        // 3. Le Prompt Système ultra-cadré
        const systemPrompt = `Tu es un assistant de recherche scientifique expert. 
RÈGLES STRICTES :
1. Réponds UNIQUEMENT à partir du [CONTEXTE SCIENTIFIQUE] fourni ci-dessous.
2. Si la réponse ne s'y trouve pas, dis explicitement "Les documents actuels de ce projet ne mentionnent pas cette information."
3. Cite toujours tes sources en utilisant le format [Source X].
4. Sois concis, analytique et direct.

[CONTEXTE SCIENTIFIQUE]
${context}`;

        try {
            // Appel à l'IA (en réutilisant ta méthode existante)
            const answer = await AiReaderService.askAI(question, systemPrompt, "meta/llama-3.1-70b-instruct");
            res.json({ answer });
        } catch (aiErr) {
            console.error("Erreur Chat RAG:", aiErr);
            res.status(500).json({ error: "Le modèle IA n'a pas pu répondre." });
        }
    });
});

router.post('/projects/:projectId/dataviz', requireAuth, (req, res) => {
    const { projectId } = req.params;
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Le prompt est requis" });

    // 1. On récupère les synthèses du projet
    const query = `
        SELECT a.title, aa.synthesis, aa.notes 
        FROM articles a 
        JOIN article_analysis aa ON a.id = aa.article_id 
        WHERE a.project_id = ?
    `;

    db.all(query, [projectId], async (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur BDD" });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: "Aucune donnée analysée dans ce projet." });
        }

        let context = rows.map((r) => `Titre: ${r.title}\nDonnées: ${r.synthesis}\n${r.notes}`).join('\n\n');
        if (context.length > 50000) context = context.substring(0, 50000);

        // 2. Le Prompt Système "Strict JSON"
        const systemPrompt = `Tu es un Data Scientist. Ton rôle est d'extraire des données statistiques du [CONTEXTE] pour répondre à la demande : "${prompt}".
RÈGLES ABSOLUES :
1. Tu DOIS répondre UNIQUEMENT par un tableau JSON valide.
2. N'écris AUCUN texte avant ou après le JSON. Pas de "Voici les données", pas de balises markdown.
3. Le JSON doit être un tableau d'objets avec deux clés: "name" (le label en X) et "value" (le nombre en Y).

Exemple de format attendu EXACT :
[
  { "name": "2018", "value": 45 },
  { "name": "2019", "value": 52 }
]

[CONTEXTE]
${context}`;

        try {
            const rawAnswer = await AiReaderService.askAI("Génère le JSON maintenant.", systemPrompt);
            
            // Nettoyage de sécurité (au cas où l'IA rajoute des balises markdown ```json)
            const cleanJson = rawAnswer.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const chartData = JSON.parse(cleanJson);
            res.json(chartData);
        } catch (aiErr) {
            console.error("Erreur DataViz:", aiErr);
            res.status(500).json({ error: "L'IA n'a pas pu extraire de données numériques valides pour cette demande." });
        }
    });
});


module.exports = router;