const axios = require('axios');
const fs = require('fs').promises;
const Logger = require('./logger.service');


class AiReaderService {

    // Découpe le texte de l'article en morceaux gérables pour l'IA (~2000 mots / chunk)
    static chunkText(text, chunkSize = 8000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * APPEL DIRECT À L'API NVIDIA NIM EN UTILISANT LE FICHIER .ENV
     */
    static async askAI(prompt, systemRole, preferredModel) {
        const API_URL = process.env.AI_API_URL;
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY || !API_URL) throw new Error("⚠️ Clé API absente.");

        // 1. Liste de cascade : Si le modèle préféré plante, on essaie les suivants dans l'ordre.
        const fallbackChain = [
            preferredModel,                         // Le choix par défaut (ex: Llama 70B)
            "meta/llama-3.1-8b-instruct",           // Secours 1 : Petit modèle très rapide
            "mistralai/mistral-large-2407",         // Secours 2 : Mistral
            "mistralai/mixtral-8x22b-instruct-v0.1" // Secours 3 : Mixtral
        ];

        // On retire les doublons au cas où le preferredModel serait déjà dans la liste
        const modelsToTry = [...new Set(fallbackChain)];

        for (const model of modelsToTry) {
            try {
                const response = await axios.post(API_URL, {
                    model: model,
                    messages: [
                        { role: "system", content: systemRole },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 4000
                }, {
                    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                    timeout: 120000
                });

                return response.data.choices[0].message.content;

            } catch (error) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;

                Logger.log(`  ⚠️ [Auto-Pilote] Le modèle ${model} a échoué (Erreur ${status}). Raison: ${errorMsg}`);

                // Si c'est une surcharge (429) ou un bug serveur (500, 503), on passe au modèle suivant !
                if (status === 429 || status >= 500) {
                    Logger.log(`  🔄 Basculement automatique vers le modèle de secours...`);
                    continue;
                } else {
                    // Si c'est une erreur de clé API (401) ou de format (400), réessayer ne servira à rien.
                    throw new Error(`Erreur fatale de configuration IA : ${errorMsg}`);
                }
            }
        }
        throw new Error("❌ Tous les modèles de secours sont surchargés ou inaccessibles.");
    }

    /**
     * PIPELINE ÉTAPE B : L'IA LECTRICE INDIVIDUELLE (Llama 3.1 70B Robuste)
     */
    static async analyzeArticle(filePath) {
        Logger.log(`🤖 Initialisation de l'Agent Lecteur pour : ${filePath}`);
        const fullText = await fs.readFile(filePath, 'utf8');
        const chunks = this.chunkText(fullText);

        Logger.log(`📦 Document découpé en ${chunks.length} segment(s). Lancement de l'analyse...`);

        // Utilisation du modèle Llama 3.1 70B qui est universel et validé sur ton compte NVIDIA NIM
        const defaultModel = "meta/llama-3.1-70b-instruct";

        Logger.log(`  🔑 [Extraction] Identification des entités et concepts fondamentaux...`);
const metadataPrompt = `Analyse rigoureusement ce début d'article scientifique. Extrais les métadonnées au format JSON avec la structure exacte suivante :
{
  "title": "Titre exact de l'étude",
  "authors": ["Auteur 1", "Auteur 2"],
  "year": "Année de publication",
  "keywords": ["Concept 1", "Concept 2", "Maladie", "Traitement", "Variable clé"],
  "methodology": "Description courte de la méthode ou du protocole",
  "study_type": "Type d'étude (ex: Méta-analyse, Essai Clinique Randomisé, Étude Observationnelle, In vitro, Revue, Prépublication)",
  "quality_score": "Un entier de 1 à 5. Donne 5 pour une Méta-analyse ou un Essai Clinique Randomisé (ECR) robuste. Donne 3 ou 4 pour une étude de cohorte solide. Donne 1 ou 2 pour une petite étude observationnelle, un cas isolé ou une prépublication non validée."
}
Texte à analyser :\n\n${chunks[0].substring(0, 4000)}`;

        const extractedMeta = await this.askAI(metadataPrompt, "Tu es un expert en extraction de données et ontologies scientifiques. Tu réponds exclusivement en JSON valide.", defaultModel);

        // ─── PASSE 2 : RÉSUMÉ ET EXTRACTION DE NOTES PAR SEGMENT ───
        let allNotes = [];

        Logger.log(`  📝 [Lecture] Analyse approfondie et prise de notes par segment...`);
        for (let index = 0; index < chunks.length; index++) {
            Logger.log(`     -> Traitement du segment ${index + 1}/${chunks.length}`);
            const chunkPrompt = `Prends des notes détaillées sur ce passage d'article scientifique. Extrais impérativement :
- Les résultats chiffrés majeurs et les statistiques évoquées.
- Les conclusions importantes de cette section.
- Les limites ou biais méthodologiques mentionnés.

Texte du segment :\n\n${chunks[index]}`;

            const segmentNotes = await this.askAI(chunkPrompt, "Tu es un chercheur scientifique rigoureux. Tu prends des notes factuelles et précises, sans jamais extrapoler ni inventer d'informations absentes du texte.", defaultModel);
            allNotes.push(`--- Notes Segment ${index + 1} ---\n${segmentNotes}`);
        }

        // ─── PASSE 3 : SYNTHÈSE GLOBALE DE L'ARTICLE ───
        Logger.log(`  🧠 [Synthèse] Génération de la synthèse structurée finale de la publication...`);
        const synthesisPrompt = `En te basant exclusivement sur tes notes de lecture suivantes, rédige une synthèse structurée de l'article incluant : les objectifs, les données clés, les conclusions et les limites de l'étude.

Notes accumulées :\n\n${allNotes.join('\n')}`;

        const articleSynthesis = await this.askAI(synthesisPrompt, "Tu es un analyste de données scientifiques. Ton rôle est de rédiger un compte rendu structuré et fidèle d'un document.", defaultModel);

        return {
            meta: extractedMeta,
            notes: allNotes.join('\n\n'),
            synthesis: articleSynthesis
        };
    }

    static async generateInspirationQueries(synthesisReport) {
        const prompt = `Voici le rapport de synthèse scientifique que tu viens de générer :
${synthesisReport.substring(0, 30000)}

Ton but est de relancer une recherche pour combler les "lacunes de la littérature" ou explorer les "nouvelles hypothèses" que tu as mentionnées.
Génère 1 à 3 requêtes de recherche très courtes et pertinentes (mots-clés scientifiques en anglais) pour interroger les bases de données mondiales (PubMed, ArXiv...).

Tu dois répondre EXCLUSIVEMENT avec un tableau JSON valide de chaînes de caractères. N'ajoute aucun texte avant ou après.
Exemple de réponse attendue : ["Alzheimer early onset biomarkers", "ViT versus CNN medical imaging"]`;

        try {
            // On demande au modèle universel de générer le JSON
            const response = await this.askAI(prompt, "Tu es un extracteur de mots-clés JSON strict. Tu ne parles qu'en JSON.", "meta/llama-3.1-70b-instruct");

            // Sécurité : on extrait uniquement ce qui ressemble à un tableau JSON avec une Regex
            const match = response.match(/\[[\s\S]*\]/);
            if (match) {
                const queries = JSON.parse(match[0]);
                return queries.slice(0, 3); // On garde max 3 requêtes pour ne pas exploser le système
            }
            return [];
        } catch (error) {
            console.error("  ⚠️ Erreur lors de l'auto-inspiration :", error.message);
            return [];
        }
    }

    /**
     * NOUVEAU : APPEL À L'IA DE VISION (Pour lire les Graphiques, Courbes et Tableaux)
     * @param {string} prompt - La question sur l'image
     * @param {string} base64Image - L'image encodée en base64 (PNG ou JPG)
     */
    static async askVisionAI(prompt, base64Image) {
        const API_URL = process.env.AI_API_URL;
        const API_KEY = process.env.AI_API_KEY;
        const visionModel = "meta/llama-3.2-90b-vision-instruct"; // Modèle Vision NVIDIA

        try {
            const response = await axios.post(API_URL, {
                model: visionModel,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    // Le format standard OpenAI / NVIDIA NIM pour envoyer une image
                                    url: `data:image/png;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.1
            }, {
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                timeout: 120000 
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error(`  ⚠️ [Erreur Vision IA] :`, error.response?.data?.error || error.message);
            return "Impossible d'analyser le graphique.";
        }
    }
}



module.exports = AiReaderService;