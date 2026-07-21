const axios = require('axios');
const fs = require('fs'); // Import standard pour les méthodes synchrones (existsSync, readdirSync)
const fsPromises = require('fs').promises; // Import pour les méthodes asynchrones (readFile, unlink)
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('./logger.service');
const db = require('../config/db');

const defaultModel = "meta/llama-3.1-70b-instruct";

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1"; // URL de sécurité par défaut si tout le reste est vide

class AiReaderService {

    static async getSettings() {
        return new Promise((resolve) => {
            db.get("SELECT api_key, ai_model, api_base_url, max_iterations FROM user_settings WHERE id = 1", (err, row) => {
                if (err || !row) {
                    resolve({ 
                        api_key: null, 
                        ai_model: defaultModel, 
                        api_base_url: process.env.AI_API_URL || process.env.NVIDIA_API_URL || defaultBaseUrl, 
                        max_iterations: 2 
                    });
                } else {
                    resolve(row);
                }
            });
        });
    }

    static chunkText(text, chunkSize = 8000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }

    static async askAI(prompt, systemPrompt = "Tu es un expert scientifique.", modelOverride = null, retries = 3) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 0; i < retries; i++) {
            try {
                const settings = await this.getSettings();
                const activeModel = modelOverride || settings.ai_model || defaultModel;
                
                // 🛑 CORRECTION ICI : Si tout est vide, on prend defaultBaseUrl pour ne jamais crasher sur .replace()
                const rawUrl = settings.api_base_url || process.env.NVIDIA_API_URL || process.env.AI_API_URL || defaultBaseUrl;
                let baseUrl = rawUrl.replace(/\/+$/, '');
                const endpoint = `${baseUrl}/chat/completions`;

                const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
                const apiKey = settings.api_key || process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || (isLocal ? "local-no-key-needed" : null);

                if (!apiKey && !isLocal) {
                    throw new Error("Clé API manquante pour ce fournisseur distant.");
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
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        timeout: 120000 // 120 secondes max
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
                max_tokens: 1500,
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

    static async analyzeArticle(filePath) {
        Logger.log(`🤖 Initialisation de l'Agent Lecteur pour : ${filePath}`);

        const fullText = await fsPromises.readFile(filePath, 'utf8');
        const chunks = this.chunkText(fullText);
        const modelToUse = "meta/llama-3.1-70b-instruct";

        Logger.log(`  🔑 [Extraction] Identification des entités et concepts fondamentaux...`);
        const metadataPrompt = `Analyse rigoureusement ce début d'article scientifique. Extrais les métadonnées au format JSON avec la structure exacte suivante :
{
  "title": "Titre exact de l'étude",
  "authors": ["Auteur 1", "Auteur 2"],
  "year": "Année de publication",
  "keywords": ["Concept 1", "Maladie", "Traitement", "Variable clé"],
  "methodology": "Description de la méthode",
  "study_type": "Type d'étude (ex: Méta-analyse, Essai Clinique Randomisé, etc.)",
  "quality_score": "Un entier de 1 à 5."
}
Texte à analyser :\n\n${chunks[0].substring(0, 4000)}`;

        const extractedMeta = await this.askAI(metadataPrompt, "Tu es expert en extraction JSON.", modelToUse);

        let allNotes = [];
        Logger.log(`  📝 [Lecture] Analyse textuelle approfondie (${chunks.length} segments)...`);

        const maxChunks = Math.min(chunks.length, 2);
        for (let index = 0; index < maxChunks; index++) {
            const chunkPrompt = `Prends des notes détaillées sur ce passage. Extrais impérativement les résultats chiffrés majeurs, les conclusions et les limites mentionnées.\n\nTexte du segment :\n\n${chunks[index]}`;
            const segmentNotes = await this.askAI(chunkPrompt, "Tu es un chercheur scientifique rigoureux.", modelToUse);
            allNotes.push(`--- Notes Texte (Segment ${index + 1}) ---\n${segmentNotes}`);
        }

        Logger.log(`  👁️ [Vision IA] Vérification du PDF pour l'analyse multimodale...`);

        try {
            const pdfFilePath = filePath.replace('.txt', '.pdf');

            if (!fs.existsSync(pdfFilePath)) {
                Logger.log(`  ⏭️ [Vision IA] Ignoré : Aucun fichier PDF complet pour cet article (Abstract uniquement).`);
            } else {
                Logger.log(`  👁️ [Vision IA] PDF détecté. Extraction des pages statistiques (2 à 5)...`);

                const imageDir = path.dirname(pdfFilePath);
                const baseName = path.basename(pdfFilePath, '.pdf');

                try {
                    execSync(`pdftoppm -f 2 -l 5 -jpeg "${pdfFilePath}" "${path.join(imageDir, baseName)}"`);
                } catch (e) {
                    Logger.log(`  ⚠️ [Vision IA] Le PDF est probablement trop court, extraction partielle.`);
                }

                const generatedFiles = fs.readdirSync(imageDir).filter(f => f.startsWith(baseName + '-') && f.endsWith('.jpg'));

                for (const file of generatedFiles) {
                    const imgPath = path.join(imageDir, file);
                    Logger.log(`     -> Scan visuel du fichier ${file}...`);
                    
                    const imgBuffer = await fsPromises.readFile(imgPath);
                    const base64Img = imgBuffer.toString('base64');

                    const visionPrompt = `Examine attentivement cette page d'article scientifique.
Y a-t-il des tableaux de données, des graphiques ou des courbes statistiques ?
Si OUI : Extrais les statistiques majeures, les valeurs exactes, et décris la tendance visible.
Si NON : Réponds exactement "Aucun graphique pertinent".`;

                    const visionResult = await this.askVisionAI(visionPrompt, base64Img);

                    if (visionResult && !visionResult.includes("Aucun graphique pertinent") && visionResult.length > 50) {
                        Logger.log(`       📊 Données visuelles extraites !`);
                        allNotes.push(`--- Données visuelles extraites des tableaux --- \n${visionResult}`);
                    }

                    await fsPromises.unlink(imgPath);
                }
            }
        } catch (visionErr) {
            Logger.log(`  ⚠️ [Vision IA] Échec de l'analyse visuelle : ${visionErr.message}`);
        }

        Logger.log(`  🧠 [Synthèse] Génération de la synthèse structurée finale...`);
        const synthesisPrompt = `En te basant exclusivement sur tes notes de lecture suivantes, rédige une synthèse structurée de l'article incluant : les objectifs, les données clés, les conclusions et les limites de l'étude.

Notes accumulées (Texte + Vision) :\n\n${allNotes.join('\n')}`;

        const articleSynthesis = await this.askAI(synthesisPrompt, "Tu es un analyste de données scientifiques.", modelToUse);

        return {
            meta: extractedMeta,
            notes: allNotes.join('\n\n'),
            synthesis: articleSynthesis
        };
    }

    static async generateInspirationQueries(synthesisReport) {
        const prompt = `Voici le rapport de synthèse scientifique :
${synthesisReport.substring(0, 30000)}

Génère 1 à 3 requêtes de recherche très courtes et pertinentes (mots-clés en anglais) pour interroger les bases de données afin de combler les lacunes ou explorer les nouvelles hypothèses.
Tu dois répondre EXCLUSIVEMENT avec un tableau JSON valide. Exemple : ["Biomarkers", "ViT versus CNN"]`;

        try {
            const response = await this.askAI(prompt, "Tu es un extracteur JSON strict.", "meta/llama-3.1-70b-instruct");            const match = response.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]).slice(0, 3);
            return [];
        } catch (error) {
            return [];
        }
    }

    static async evaluateRelevance(rootTopic, proposedSubtopic, currentDepth) {
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
            // 🛑 CORRECTION ICI : On remplace le 'callLLM' fantôme par this.askAI
            const response = await this.askAI(userPrompt, systemPrompt, defaultModel);
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

    static async analyzeArticleWithTheme(articleText, articleTitle, coreTheme = "") {
        const anchorInstruction = coreTheme 
            ? `RÈGLE ABSOLUE ANTI-DÉRIVE : Ton analyse DOIT ÊTRE STRICTEMENT ANCRÉE dans le thème principal suivant : "${coreTheme}". Ignore toute information scientifique qui n'a pas de lien direct ou indirect avec ce sujet précis.`
            : "";

        const systemPrompt = `Tu es un chercheur expert spécialisé dans l'analyse scientifique et la taxonomie de données.
${anchorInstruction}

Tu dois analyser le texte fourni et retourner STRICTEMENT un objet JSON valide (sans aucun texte autour, sans balises markdown \`\`\`json).

Structure exacte attendue pour l'objet JSON :
{
  "metadata": "Auteurs, Institution, Année et méthodologie utilisée",
  "macro_theme": "Une étiquette globale courte (2-3 mots max) qui classe cet article (ex: Précision des capteurs, Effets cliniques, Méthodologie, Étude de cas...)",
  "micro_themes": ["mot-clé 1", "mot-clé 2", "mot-clé 3"],
  "notes": "Notes de lecture brutes, chiffres clés, limites de l'étude",
  "synthesis": "Synthèse analytique claire de l'article centrée sur le thème"
}`;

        const prompt = `Voici l'article à analyser :
Titre : ${articleTitle}
Contenu :
${articleText.substring(0, 30000)}`;

        try {
            const rawResponse = await this.askAI(prompt, systemPrompt);
            const cleanJson = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("❌ Erreur de parsing JSON dans l'analyse catégorisée, repli standard.", error.message);
            return {
                metadata: "Extraction automatique",
                macro_theme: "Non classé",
                micro_themes: [],
                notes: "Erreur de formatage IA",
                synthesis: "Article lu mais non catégorisé. Veuillez relancer."
            };
        }
    }
}

module.exports = AiReaderService;