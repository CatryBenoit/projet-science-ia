const axios = require('axios');
const fs = require('fs').promises;

class AiReaderService {
    
    // Découpe le texte en morceaux pour l'IA
    static chunkText(text, chunkSize = 8000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // Fonction d'appel générique à ton IA (NVIDIA NIM)
    static async askAI(prompt, systemRole) {
        // Remplace par ton URL d'API (NVIDIA ou Ollama)
        const response = await axios.post('http://localhost:3001/api/ai/ask-nvidia', {
            prompt: prompt,
            system: systemRole
        });
        return response.data.response;
    }

    static async analyzeArticle(filePath) {
        const fullText = await fs.readFile(filePath, 'utf8');
        const chunks = this.chunkText(fullText);

        console.log(`🤖 IA Lectrice : Analyse de ${chunks.length} segments...`);

        // 1. Extraction Métadonnées (Passage sur le 1er chunk uniquement)
        const meta = await this.askAI(
            `Extrais les métadonnées de ce texte : Titre, Auteur(s), Année, Objectif principal. Réponds en JSON. \n\nTexte : ${chunks[0].substring(0, 2000)}`,
            "Tu es un expert documentaliste scientifique."
        );

        // 2. Extraction Points Clés et Notes (Boucle sur les chunks)
        let allNotes = [];
        for (const chunk of chunks) {
            const notes = await this.askAI(
                `Extrais les points clés, les résultats chiffrés et les observations importantes de ce passage : \n\n${chunk}`,
                "Tu es un chercheur scientifique qui prend des notes détaillées."
            );
            allNotes.push(notes);
        }

        // 3. Synthèse Thématique (Passage final)
        const synthesis = await this.askAI(
            `Voici toutes les notes extraites : ${allNotes.join('\n')}. Fais-en une synthèse globale sur les données thématiques (résultats, méthodes, limites).`,
            "Tu es un analyste de données scientifiques."
        );

        return { meta, notes: allNotes.join('\n'), synthesis };
    }
}

module.exports = AiReaderService;