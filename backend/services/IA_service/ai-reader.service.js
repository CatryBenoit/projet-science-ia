const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../app_Service/logger.service');
const db = require('../../config/db');

const settingModel = require('../../Models/setting.model');
const { log } = require('console');

const defaultModel = "meta/llama-3.1-70b-instruct";

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";

class AiReaderService {

    //recuper les paramettre de l'utilisateur 
static async getSettings() {
    try {
        // On attend simplement la réponse du Modèle
        // Note : Si ta méthode dans le modèle s'appelle getSettings(), mets bien getSettings() au lieu de getUserSetting(1)
        const settings = await settingModel.getUserSetting(1); 
        return settings || {}; 
    } catch (error) {
        Logger.log(`⚠️ Impossible de charger les paramètres : ${error.message}`);
        return {}; // On renvoie un objet vide pour ne pas faire crasher l'IA
    }
}


    // Permet de demmander a l'ia queque chose 
    static async askAI(prompt, systemPrompt = "Tu es un expert scientifique.", modelOverride = null, retries = 3) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 0; i < retries; i++) {
            try {
                const settings = await this.getSettings();
                const activeModel = modelOverride || settings.ai_model || defaultModel;

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


    // permet a l'ia de visioner un image et de prendre les info de celle ci 
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


    static async analyzeArticle(filePath) {
        Logger.log(`🤖 Initialisation du pool d'Agents pour : ${filePath}`);

        const fullText = await fsPromises.readFile(filePath, 'utf8');

        const safeText = fullText.substring(0, 350000);

        const modelToUse = "meta/llama-3.1-70b-instruct";

        //Premier analyse 
        const extractedMeta = await this.initialAnalys(safeText, modelToUse);
        console.log(extractedMeta);


        // ─── AGENT 2 : LE CHERCHEUR (Premier Brouillon) ───
        const draftNotes = await this.firstAnalys(safeText, modelToUse)
        console.log(draftNotes);

        let allNotes = `--- Brouillon Initial (Agent Chercheur) ---\n${draftNotes}`;

        // ─── AGENT 3 : L'ANALYSTE VISION (Optionnel - Graphiques) ───
        Logger.log(`  👁️ [Agent Vision] Vérification du PDF pour l'analyse multimodale...`);
        try {
            const pdfFilePath = filePath.replace('.txt', '.pdf');
            
            if (fs.existsSync(pdfFilePath)) {
                Logger.log(`  👁️ [Agent Vision] PDF détecté. Scan des graphiques avec pdf2pic...`);
                const imageDir = path.dirname(pdfFilePath);
                const baseName = path.basename(pdfFilePath, '.pdf');

                // Import dynamique de la librairie
                const { fromPath } = require("pdf2pic");

                // Configuration de la conversion (DPI, format, etc.)
                const options = {
                    density: 150,           
                    saveFilename: baseName, 
                    savePath: imageDir,     
                    format: "jpg",
                    width: 1024,
                    height: 1448
                };

                const storeAsImage = fromPath(pdfFilePath, options);

                // On scanne les pages 2 à 5 (là où se trouvent généralement les gros tableaux et graphiques)
                for (let pageNum = 2; pageNum <= 5; pageNum++) {
                    try {
                        const data = await storeAsImage(pageNum);
                        
                        // Lecture de l'image générée
                        const imgBuffer = await fsPromises.readFile(data.path);
                        const base64Img = imgBuffer.toString('base64');

                        const visionPrompt = `Examine cette page. Si tu vois des tableaux ou des graphiques, extrais les statistiques majeures. Sinon, réponds "Aucun graphique pertinent".`;
                        
                        Logger.log(`      📸 Analyse de la page ${pageNum} par l'IA...`);
                        const visionResult = await this.askVisionAI(visionPrompt, base64Img);

                        if (visionResult && !visionResult.includes("Aucun graphique pertinent") && visionResult.length > 50) {
                            Logger.log(`      📊 Données visuelles extraites de la page ${pageNum} !`);
                            allNotes += `\n\n--- Données visuelles extraites (Page ${pageNum}) ---\n${visionResult}`;
                        }
                        
                        // Suppression de l'image temporaire pour ne pas surcharger le disque
                        await fsPromises.unlink(data.path);
                        
                        // Petite pause pour ne pas spammer l'API Vision
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (pageErr) {
                        // Si la page n'existe pas (ex: le PDF n'a que 3 pages et on cherche la 4ème), on arrête la boucle Vision
                        break; 
                    }
                }
            }
        } catch (visionErr) {
            Logger.log(`  ⚠️ [Agent Vision] Échec : ${visionErr.message}`);
        }

        // ─── AGENT 4 : LE RÉVISEUR INTRANSIGEANT (Peer-Review) ───

        const critique = await this.PeerReview(allNotes, modelToUse);
        console.log(critique);


        // ─── AGENT 5 : L'ÉDITEUR EN CHEF (Synthèse Finale) ───
        const articleSynthesis = await this.finalSynthesis(allNotes, critique, modelToUse)
        console.log(articleSynthesis);

        return {
            meta: extractedMeta,
            notes: allNotes + `\n\n--- Critiques du Peer-Review ---\n${critique}`,
            synthesis: articleSynthesis
        };
    }

    static async generateInspirationQueries(synthesisReport) {
        const prompt = `Voici le rapport de synthèse scientifique :
${synthesisReport.substring(0, 30000)}

Génère 1 à 3 requêtes de recherche très courtes et pertinentes (mots-clés en anglais) pour interroger les bases de données afin de combler les lacunes ou explorer les nouvelles hypothèses.
Tu dois répondre EXCLUSIVEMENT avec un tableau JSON valide. Exemple : ["Biomarkers", "ViT versus CNN"]`;

        try {
            const response = await this.askAI(prompt, "Tu es un extracteur JSON strict.", "meta/llama-3.1-70b-instruct"); const match = response.match(/\[[\s\S]*\]/);
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


static async initialAnalys(Text, model) {
        Logger.log(`  📂 [Agent Archiviste] Extraction des concepts fondamentaux...`);
        
        const systemPrompt = "Tu es un data-scientiste expert en taxonomie. Tu réponds STRICTEMENT et UNIQUEMENT en JSON, sans aucun texte avant ou après.";
        
        const metadataPrompt = `Analyse rigoureusement cet article scientifique. Extrais les métadonnées au format JSON avec la structure exacte suivante :
{
  "title": "Titre exact de l'étude",
  "authors": ["Auteur 1", "Auteur 2"],
  "year": "Année de publication (ou 'Non spécifiée')",
  "keywords": ["Mot-clé 1", "Mot-clé 2", "Mot-clé 3"],
  "methodology": "Brève description de la méthodologie (ex: 'Étude de cohorte', 'Essai in vitro')",
  "study_type": "Type d'étude",
  "quality_score": "Entier de 1 à 5."
}

RÈGLES ABSOLUES :
1. Si une information est introuvable, utilise la valeur "Non spécifié" (ou un tableau vide []). N'invente rien.
2. Pour le 'quality_score', utilise cette grille :
   - 1 : Opinion, éditorial ou source non scientifique.
   - 2 : Étude de cas unique ou observationnelle faible.
   - 3 : Étude observationnelle solide ou cohorte.
   - 4 : Essai clinique randomisé ou étude expérimentale contrôlée.
   - 5 : Méta-analyse ou revue systématique de haute qualité.

Texte intégral :
<texte>
${Text}
</texte>`;

        return await this.askAI(metadataPrompt, systemPrompt, model);
    }


static async firstAnalys(Text, model) {
        Logger.log(`  📝 [Agent Chercheur] Lecture du document complet et rédaction du brouillon...`);
        
        const systemPrompt = "Tu es un chercheur scientifique rigoureux. Ton objectif est d'extraire la substance technique d'un article sans la déformer.";
        
        const draftPrompt = `Lis attentivement l'article scientifique ci-dessous et rédige un premier brouillon d'analyse.

Tu DOIS structurer ta réponse exactement avec ces sections Markdown :

### 🎯 Hypothèses et Objectifs
(Que cherchent-ils à prouver ?)

### 🧪 Méthodologie et Échantillon
(Comment ont-ils procédé ? Précise impérativement la taille de l'échantillon 'N' si disponible, la durée, et le type de tests).

### 📊 Résultats Chiffrés
(Quels sont les résultats majeurs ? Tu dois extraire les pourcentages pertinents, les valeurs statistiques comme les p-values, ou les marges d'erreur).

### ⚠️ Limites de l'étude
(Quels sont les biais ou limites avoués par les auteurs eux-mêmes ?)

Texte de l'article :
<texte>
${Text}
</texte>`;

        return await this.askAI(draftPrompt, systemPrompt, model);
    }


    static async PeerReview(originalText, draftNote, model) {
        Logger.log(`  🔬 [Agent Réviseur] Audit critique du brouillon...`);
        
        const systemPrompt = "Tu es un relecteur scientifique (Peer-Reviewer) extrêmement sévère, pointilleux et factuel.";
        
        const reviewPrompt = `Voici le texte original d'un article scientifique, suivi d'un brouillon de synthèse rédigé par un assistant.
Ton rôle est de faire l'audit critique de ce brouillon.

TA MISSION :
1. Débusquer les hallucinations (faits présents dans le brouillon mais absents du texte).
2. Pointer les omissions graves (chiffres clés ou nuances majeures du texte ignorés dans le brouillon).
3. Vérifier que les limites de l'étude ne sont pas minimisées.

Rédige une liste stricte et concise des corrections à apporter, sous forme de tirets. Ne réécris pas la synthèse, donne juste tes directives de correction.

--- TEXTE ORIGINAL ---
<texte>
${originalText}
</texte>

--- BROUILLON À AUDITER ---
<brouillon>
${draftNote}
</brouillon>`;

        return await this.askAI(reviewPrompt, systemPrompt, model);
    }



    static async finalSynthesis(draftNote, critique, model) {
        Logger.log(`  🧠 [Agent Éditeur] Fusion, correction et rédaction de la synthèse finale...`);
        
        const systemPrompt = "Tu es le Rédacteur en Chef d'un grand journal scientifique. Tu as un esprit de synthèse exceptionnel et une plume claire.";
        
        const finalSynthesisPrompt = `Tu disposes d'un premier brouillon de lecture, et des critiques sévères du comité de relecture (Peer-Review).
Ta tâche est de rédiger la synthèse finale et parfaite de cet article en corrigeant les erreurs du brouillon pointées par le comité.

RÈGLES DE RÉDACTION :
- Utilise un ton professionnel, neutre et objectif.
- La synthèse finale doit être claire et magnifiquement formatée en Markdown pour être publiée dans un rapport R&D (utilise des titres en gras, des listes à puces pour les résultats).
- Assure-toi que toutes les critiques du comité ont été prises en compte.

--- BROUILLON INITIAL ---
${draftNote}

--- CRITIQUES DU COMITÉ À INTÉGRER ---
${critique}

Rédige le rapport final complet maintenant :`;

        return await this.askAI(finalSynthesisPrompt, systemPrompt, model);
    }

/**
     * 🛡️ L'AGENT VIDEUR : Évalue si un article est pertinent avant de le télécharger
     */
    static async evaluateArticleRelevance(topic, articleTitle, articleAbstract) {
        const systemPrompt = `Tu es un filtreur de recherche scientifique impitoyable (un "videur"). Ta seule mission est d'éliminer les articles hors-sujet renvoyés par les moteurs de recherche basés sur de simples mots-clés. Tu dois répondre STRICTEMENT et UNIQUEMENT en JSON.`;

        const userPrompt = `
SUJET RECHERCHÉ PAR L'UTILISATEUR : "${topic}"

ARTICLE TROUVÉ PAR LE MOTEUR :
Titre : "${articleTitle}"
Résumé (Abstract) : "${articleAbstract ? articleAbstract.substring(0, 1500) : 'Non disponible'}"

Analyse sémantiquement si cet article parle BIEN du sujet recherché.
Par exemple, si on cherche "morsure de chien" et que l'article parle de "chien robot", c'est hors-sujet complet (PRUNE).

Réponds UNIQUEMENT avec cet objet JSON valide :
{
  "reasoning": "Explication très courte de ta décision.",
  "score": <entier entre 0 et 10>,
  "decision": "KEEP" | "PRUNE"
}

Grille de décision absolue :
0 à 6 : Hors-sujet, ambigu, ou lien trop faible -> PRUNE
7 à 10 : Exactement dans le thème ou très pertinent -> KEEP
`;

        try {
            // On utilise le modèle par défaut avec notre méthode robuste (et ses retries)
            const response = await this.askAI(userPrompt, systemPrompt, "meta/llama-3.1-70b-instruct");
            const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("⚠️ Erreur de l'Agent Videur, on garde l'article par défaut :", error.message);
            // En cas d'erreur API, on préfère garder l'article pour ne rien rater
            return { decision: "KEEP", score: 5, reasoning: "Bypass suite à une erreur technique." };
        }
    }   
    
    static async detectConflictsOfInterest(articleText) {
        // Pour économiser des tokens et aller plus vite, le détective ne lit que 
        // les 3000 derniers et 3000 premiers caractères (là où se trouvent les disclaimers)
        const textToAnalyze = articleText.length > 6000 
            ? articleText.substring(0, 3000) + "\n\n[...]\n\n" + articleText.substring(articleText.length - 3000)
            : articleText;

        const prompt = `
Tu es un agent détective spécialisé dans l'éthique de la recherche scientifique.
Ta mission est d'analyser ce texte extrait d'un article scientifique et de repérer TOUT conflit d'intérêts potentiel (Conflict of Interest, Competing Interests, Funding, Acknowledgements).

Texte de l'article :
"""
${textToAnalyze}
"""

Instructions strictes :
1. Cherche qui a financé l'étude.
2. Cherche si les auteurs déclarent des liens avec des entreprises privées.
3. Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour.

Format JSON attendu :
{
    "hasConflict": true ou false,
    "severity": "LOW", "MEDIUM" ou "HIGH",
    "details": "Explication courte en français de qui finance ou du conflit (ex: 'L'auteur principal est consultant pour Pfizer'). Si rien, mets 'Aucun conflit détecté'."
}
`;

        try {
            // Remplace par ta méthode d'appel à ton modèle d'IA (ex: Llama / OpenAI)
            // On peut même utiliser un petit modèle rapide ici !
            const response = await this.callAIModel(prompt, { jsonMode: true }); 
            
            // Nettoyage de la réponse pour s'assurer d'avoir du JSON pur
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("🕵️ Erreur de l'Agent Détective :", error.message);
            return { hasConflict: false, severity: "LOW", details: "Erreur lors de l'analyse éthique." };
        }
    }
}




module.exports = AiReaderService;