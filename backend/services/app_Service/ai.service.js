const ProjectModel = require('../../models/project.model');
const AiReaderService = require('./ai-reader.service');

class AiService {
    /**
     * Poser une question brute à l'IA (remplace l'appel manuel axios)
     */
    static async askRaw(prompt, system, model) {
        // On réutilise notre AiReaderService ultra-robuste au lieu de refaire axios.post
        return await AiReaderService.askAI(prompt, system, model);
    }

    /**
     * Mode RAG : Répondre à une question en se basant sur la synthèse d'un projet
     */
    static async chatRAG(projectId, question) {
        const rows = await ProjectModel.getAnalyzedArticles(projectId);
        
        if (!rows || rows.length === 0) {
            return "Je n'ai pas encore lu d'articles pour ce projet. Lancez d'abord une recherche.";
        }

        // Construction du contexte RAG
        let context = rows.map((r, i) => `[Source ${i+1}: ${r.title}]\nSynthèse: ${r.synthesis}\n`).join('\n\n');
        if (context.length > 50000) context = context.substring(0, 50000) + "\n...[Contexte tronqué]...";

        const systemPrompt = `Tu es un assistant de recherche scientifique expert. 
RÈGLES STRICTES :
1. Réponds UNIQUEMENT à partir du [CONTEXTE SCIENTIFIQUE] fourni ci-dessous.
2. Si la réponse ne s'y trouve pas, dis explicitement "Les documents actuels de ce projet ne mentionnent pas cette information."
3. Cite toujours tes sources en utilisant le format [Source X].
4. Sois concis, analytique et direct.

[CONTEXTE SCIENTIFIQUE]
${context}`;

        return await AiReaderService.askAI(question, systemPrompt);
    }

    /**
     * Mode DataViz : Extraire des données au format JSON
     */
    static async generateDataviz(projectId, prompt) {
        const rows = await ProjectModel.getAnalyzedArticles(projectId);
        
        if (!rows || rows.length === 0) {
            throw new Error("Aucune donnée analysée dans ce projet.");
        }

        let context = rows.map((r) => `Titre: ${r.title}\nDonnées: ${r.synthesis}\n${r.notes}`).join('\n\n');
        if (context.length > 50000) context = context.substring(0, 50000);

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

        const rawAnswer = await AiReaderService.askAI("Génère le JSON maintenant.", systemPrompt);
        const cleanJson = rawAnswer.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    }
}

module.exports = AiService;