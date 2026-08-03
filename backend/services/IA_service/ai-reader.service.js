const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../app_Service/logger.service');
const db = require('../../config/db');

// N'oublie pas : setting.model au singulier !
const settingModel = require('../../Models/settings.model');
const AiRoutingModel = require('../../Models/ai_routing.model'); // 👈 L'import de ton super-routeur
const { log } = require('console');

const defaultModel = "meta/llama-3.1-70b-instruct";
const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";

class AiReaderService {

    // Récupérer les paramètres globaux de l'utilisateur (le fallback)
    static async getSettings() {
        try {
            const settings = await settingModel.getUserSetting(1); 
            return settings || {}; 
        } catch (error) {
            Logger.log(`⚠️ Impossible de charger les paramètres : ${error.message}`);
            return {};
        }
    }

    // 🔀 NOUVEAU MOTEUR MULTI-API : Il prend le rôle en compte !
    static async askAI(userId = 1, role, prompt, systemPrompt = "Tu es un expert scientifique.", retries = 3) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 0; i < retries; i++) {
            try {
                // 1. On interroge le routeur pour ce rôle spécifique
                const route = await AiRoutingModel.getRouteForRole(userId, role);
                const settings = await this.getSettings();

                let activeModel, baseUrl, apiKey;

                // 2. Si une route spécifique existe pour ce rôle
                if (route && route.model_name && route.base_url) {
                    activeModel = route.model_name;
                    baseUrl = route.base_url.replace(/\/+$/, '');
                    apiKey = route.api_key;
                    Logger.log(`🔀 [ROUTAGE] Agent '${role}' utilise ${activeModel} via ${baseUrl}`);
                } else {
                    // 3. Sinon, Fallback sur le modèle global par défaut
                    activeModel = settings.ai_model || defaultModel;
                    const rawUrl = settings.api_base_url || process.env.NVIDIA_API_URL || process.env.AI_API_URL || defaultBaseUrl;
                    baseUrl = rawUrl.replace(/\/+$/, '');
                    apiKey = settings.api_key || process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
                    Logger.log(`⚠️ [ROUTAGE] Agent '${role}' utilise le modèle global (Défaut) : ${activeModel}`);
                }

                const endpoint = `${baseUrl}/chat/completions`;
                const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
                
                if (!apiKey && !isLocal) {
                    throw new Error(`Clé API manquante pour l'agent ${role}.`);
                }

                const response = await axios.post(
                    endpoint,
                    {
                        model: activeModel,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.3
                    },
                    {
                        headers: {
                            "Authorization": `Bearer ${apiKey || 'local-no-key'}`,
                            "Content-Type": "application/json"
                        },
                        timeout: 120000
                    }
                );

                return response.data.choices[0].message.content;

            } catch (error) {
                const status = error.response?.status;
                const errorMessage = error.response?.data?.error?.message || error.message;

                if ((status === 429 || errorMessage.includes('timeout')) && i < retries - 1) {
                    console.log(`⚠️ Surcharge API (${status || 'Timeout'}). Pause de 10s avant réessai... (${i + 1}/${retries})`);
                    await wait(10000);
                    continue;
                }

                console.error(`❌ Erreur API IA (${error.config?.url || 'endpoint inconnu'}) :`, errorMessage);
                throw error;
            }
        }
    }


    // Permet à l'IA de visionner une image
    static async askVisionAI(prompt, base64Image) {
        const API_URL = process.env.AI_API_URL || process.env.NVIDIA_API_URL || defaultBaseUrl;
        const API_KEY = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
        const visionModel = "meta/llama-3.2-90b-vision-instruct";
        try {
            const response = await axios.post(`${API_URL.replace(/\/+$/, '')}/chat/completions`, {
                model: visionModel,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: { url: `data:image/png;base64,${base64Image}` }
                            }
                        ]
                    }
                ],
                max_tokens: 15000,
                temperature: 0.1
            }, {
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                timeout: 120000
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            Logger.log(`  ⚠️ [Erreur Vision IA] : ${error.response?.data?.error?.message || error.message}`);
            return "Aucun graphique pertinent (Erreur technique).";
        }
    }


    static async analyzeArticle(filePath, userId = 1) {
        Logger.log(`🤖 Initialisation du pool d'Agents pour : ${filePath}`);

        const fullText = await fsPromises.readFile(filePath, 'utf8');
        const safeText = fullText.substring(0, 350000);

        // ─── AGENT 1 : ARCHIVISTE (Analyse Métadonnées) ───
        const extractedMeta = await this.initialAnalys(safeText, userId);
        console.log("META EXTRAIT:", extractedMeta);

        // ─── AGENT 2 : LE CHERCHEUR (Premier Brouillon) ───
        const draftNotes = await this.firstAnalys(safeText, userId)
        console.log("BROUILLON:", draftNotes);

        let allNotes = `--- Brouillon Initial (Agent Chercheur) ---\n${draftNotes}`;

        // ─── AGENT 3 : L'ANALYSTE VISION (Optionnel - Graphiques) ───
        Logger.log(`  👁️ [Agent Vision] Vérification du PDF pour l'analyse multimodale...`);
        try {
            const pdfFilePath = filePath.replace('.txt', '.pdf');
            if (fs.existsSync(pdfFilePath)) {
                Logger.log(`  👁️ [Agent Vision] PDF détecté. Scan des graphiques avec pdf2pic...`);
                const imageDir = path.dirname(pdfFilePath);
                const baseName = path.basename(pdfFilePath, '.pdf');
                const { fromPath } = require("pdf2pic");

                const options = {
                    density: 150,           
                    saveFilename: baseName, 
                    savePath: imageDir,     
                    format: "jpg",
                    width: 1024,
                    height: 1448
                };

                const storeAsImage = fromPath(pdfFilePath, options);

                for (let pageNum = 2; pageNum <= 5; pageNum++) {
                    try {
                        const data = await storeAsImage(pageNum);
                        const imgBuffer = await fsPromises.readFile(data.path);
                        const base64Img = imgBuffer.toString('base64');
                        const visionPrompt = `Examine cette page. Si tu vois des tableaux ou des graphiques, extrais les statistiques majeures. Sinon, réponds "Aucun graphique pertinent".`;
                        
                        Logger.log(`      📸 Analyse de la page ${pageNum} par l'IA Vision...`);
                        const visionResult = await this.askVisionAI(visionPrompt, base64Img);

                        if (visionResult && !visionResult.includes("Aucun graphique pertinent") && visionResult.length > 50) {
                            Logger.log(`      📊 Données visuelles extraites de la page ${pageNum} !`);
                            allNotes += `\n\n--- Données visuelles extraites (Page ${pageNum}) ---\n${visionResult}`;
                        }
                        
                        await fsPromises.unlink(data.path);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (pageErr) {
                        break; 
                    }
                }
            }
        } catch (visionErr) {
            Logger.log(`  ⚠️ [Agent Vision] Échec : ${visionErr.message}`);
        }

        // ─── AGENT 4 : LE RÉVISEUR INTRANSIGEANT (Peer-Review) ───
        const critique = await this.PeerReview(safeText, allNotes, userId);
        console.log("CRITIQUE:", critique);

        // ─── AGENT 5 : L'ÉDITEUR EN CHEF (Synthèse Finale) ───
        const articleSynthesis = await this.finalSynthesis(allNotes, critique, userId)
        console.log("SYNTHESE FINALE:", articleSynthesis);

        return {
            meta: extractedMeta,
            notes: allNotes + `\n\n--- Critiques du Peer-Review ---\n${critique}`,
            synthesis: articleSynthesis
        };
    }

    static async generateInspirationQueries(synthesisReport, userId = 1) {
        const prompt = `Voici le rapport de synthèse scientifique :
${synthesisReport.substring(0, 30000)}

Génère 1 à 3 requêtes de recherche très courtes et pertinentes (mots-clés en anglais) pour interroger les bases de données afin de combler les lacunes ou explorer les nouvelles hypothèses.
Tu dois répondre EXCLUSIVEMENT avec un tableau JSON valide. Exemple : ["Biomarkers", "ViT versus CNN"]`;

        try {
            const response = await this.askAI(userId, 'inspiration', prompt, "Tu es un extracteur JSON strict."); 
            const match = response.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]).slice(0, 3);
            return [];
        } catch (error) {
            return [];
        }
    }


    static async evaluateRelevance(rootTopic, proposedSubtopic, currentDepth, userId = 1) {
        const systemPrompt = `Tu es un auditeur scientifique strict. Ta seule tâche est d'évaluer si une nouvelle piste de recherche reste parfaitement ancrée dans le thème racine d'un projet ou si elle commence à dériver (hors-sujet, trop généraliste, ou lien trop indirect).`;

        const userPrompt = `
THÈME RACINE DU PROJET (IMMUABLE) : "${rootTopic}"
PISTE PROPOSÉE À ÉVALUER : "${proposedSubtopic}"
NIVEAU D'ITÉRATION ACTUEL : ${currentDepth}

Évalue la pertinence et réponds UNIQUEMENT sous forme d'objet JSON valide avec ce format exact :
{
  "chain_of_thought": "Explication en une phrase justifiant la note.",
  "relevance_score": <entier entre 0 et 10>,
  "decision": "KEEP" | "PRUNE"
}

Grille de notation stricte :
- 0 à 3 : Hors-sujet complet ou dérive évidente -> "PRUNE"
- 4 à 6 : Sujet connexe mais trop généraliste ou trop éloigné de la question centrale -> "PRUNE"
- 7 à 10 : Piste pertinente qui approfondit directement un aspect technique du thème racine -> "KEEP"`;

        try {
            const response = await this.askAI(userId, 'guardrail', userPrompt, systemPrompt);
            const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("Erreur lors de l'évaluation du guardrail anti-dérive :", error.message);
            return {
                relevance_score: 0,
                decision: "PRUNE",
                chain_of_thought: "Échec de l'évaluation par le guardrail automatique."
            };
        }
    }


    static async initialAnalys(Text, userId = 1) {
        Logger.log(`  📂 [Agent Archiviste] Extraction des concepts fondamentaux...`);
        const systemPrompt = "Tu es un data-scientiste expert en taxonomie. Tu réponds STRICTEMENT et UNIQUEMENT en JSON, sans aucun texte avant ou après.";
        const metadataPrompt = `Analyse rigoureusement cet article scientifique. Extrais les métadonnées au format JSON avec la structure exacte suivante :
{
  "title": "Titre exact de l'étude",
  "authors": ["Auteur 1", "Auteur 2"],
  "year": "Année de publication (ou 'Non spécifiée')",
  "keywords": ["Mot-clé 1", "Mot-clé 2", "Mot-clé 3"],
  "methodology": "Brève description de la méthodologie",
  "study_type": "Type d'étude",
  "quality_score": "Entier de 1 à 5."
}

Texte intégral :
<texte>
${Text}
</texte>`;

        return await this.askAI(userId, 'analysis', metadataPrompt, systemPrompt);
    }


    static async firstAnalys(Text, userId = 1) {
        Logger.log(`  📝 [Agent Chercheur] Lecture du document complet et rédaction du brouillon...`);
        const systemPrompt = "Tu es un chercheur scientifique rigoureux. Ton objectif est d'extraire la substance technique d'un article sans la déformer.";
        const draftPrompt = `Lis attentivement l'article scientifique ci-dessous et rédige un premier brouillon d'analyse.
Tu DOIS structurer ta réponse exactement avec ces sections Markdown :

### 🎯 Hypothèses et Objectifs
### 🧪 Méthodologie et Échantillon
### 📊 Résultats Chiffrés
### ⚠️ Limites de l'étude

Texte de l'article :
<texte>
${Text}
</texte>`;

        return await this.askAI(userId, 'analysis', draftPrompt, systemPrompt);
    }


    static async PeerReview(originalText, draftNote, userId = 1) {
        Logger.log(`  🔬 [Agent Réviseur] Audit critique du brouillon...`);
        const systemPrompt = "Tu es un relecteur scientifique (Peer-Reviewer) extrêmement sévère, pointilleux et factuel.";
        const reviewPrompt = `Voici le texte original d'un article scientifique, suivi d'un brouillon de synthèse rédigé par un assistant.
Ton rôle est de faire l'audit critique de ce brouillon.

TA MISSION :
1. Débusquer les hallucinations.
2. Pointer les omissions graves.
3. Vérifier que les limites de l'étude ne sont pas minimisées.

Rédige une liste stricte et concise des corrections à apporter, sous forme de tirets.

--- TEXTE ORIGINAL ---
<texte>
${originalText}
</texte>

--- BROUILLON À AUDITER ---
<brouillon>
${draftNote}
</brouillon>`;

        return await this.askAI(userId, 'synthesis', reviewPrompt, systemPrompt);
    }


    static async finalSynthesis(draftNote, critique, userId = 1) {
        Logger.log(`  🧠 [Agent Éditeur] Fusion, correction et rédaction de la synthèse finale...`);
        const systemPrompt = "Tu es le Rédacteur en Chef d'un grand journal scientifique. Tu as un esprit de synthèse exceptionnel et une plume claire.";
        const finalSynthesisPrompt = `Tu disposes d'un premier brouillon de lecture, et des critiques sévères du comité de relecture (Peer-Review).
Ta tâche est de rédiger la synthèse finale en corrigeant les erreurs du brouillon pointées par le comité.

--- BROUILLON INITIAL ---
${draftNote}

--- CRITIQUES DU COMITÉ À INTÉGRER ---
${critique}

Rédige le rapport final complet maintenant en Markdown :`;

        return await this.askAI(userId, 'synthesis', finalSynthesisPrompt, systemPrompt);
    }

    /**
     * 🛡️ L'AGENT VIDEUR : Évalue si un article est pertinent avant de le télécharger
     */
    static async evaluateArticleRelevance(topic, articleTitle, articleAbstract, userId = 1) {
        const systemPrompt = `Tu es un filtreur de recherche scientifique impitoyable (un "videur"). Ta seule mission est d'éliminer les articles hors-sujet. Tu dois répondre STRICTEMENT et UNIQUEMENT en JSON.`;

        const userPrompt = `
SUJET RECHERCHÉ PAR L'UTILISATEUR : "${topic}"

ARTICLE TROUVÉ PAR LE MOTEUR :
Titre : "${articleTitle}"
Résumé (Abstract) : "${articleAbstract ? articleAbstract.substring(0, 1500) : 'Non disponible'}"

Analyse sémantiquement si cet article parle BIEN du sujet recherché.

Réponds UNIQUEMENT avec cet objet JSON valide :
{
  "reasoning": "Explication très courte de ta décision.",
  "score": <entier entre 0 et 10>,
  "decision": "KEEP" | "PRUNE"
}`;

        try {
            const response = await this.askAI(userId, 'guardrail', userPrompt, systemPrompt);
            const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("⚠️ Erreur de l'Agent Videur, on garde l'article par défaut :", error.message);
            return { decision: "KEEP", score: 5, reasoning: "Bypass suite à une erreur technique." };
        }
    }   
    
    /**
     * 🕵️ L'AGENT DÉTECTIVE : Détection de conflits d'intérêts
     */
    static async detectConflictsOfInterest(articleText, userId = 1) {
        const textToAnalyze = articleText.length > 6000 
            ? articleText.substring(0, 3000) + "\n\n[...]\n\n" + articleText.substring(articleText.length - 3000)
            : articleText;

        const systemPrompt = "Tu es un enquêteur en éthique scientifique. Réponds STRICTEMENT en JSON pur.";
        const prompt = `
Ta mission est d'analyser ce texte extrait d'un article scientifique et de repérer TOUT conflit d'intérêts potentiel (Funding, Acknowledgements, Competing Interests).

Texte de l'article :
"""
${textToAnalyze}
"""

Format JSON attendu :
{
    "hasConflict": true ou false,
    "severity": "LOW", "MEDIUM" ou "HIGH",
    "details": "Explication courte en français de qui finance ou du conflit."
}`;

        try {
            const response = await this.askAI(userId, 'detective', prompt, systemPrompt, 2); 
            const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("🕵️ Erreur de l'Agent Détective :", error.message);
            return { hasConflict: false, severity: "LOW", details: "Erreur lors de l'analyse éthique." };
        }
    }
}

module.exports = AiReaderService;