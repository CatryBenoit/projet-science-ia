const axios = require('axios');
const fs = require('fs').promises;
const Logger = require('./logger.service');
const db = require('../config/db');
const defaultModel = "meta-llama/llama-3.1-70b-instruct";


class AiReaderService {

    static chunkText(text, chunkSize = 8000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }

static async askAI(prompt, systemPrompt = "Tu es un expert scientifique.", modelOverride = null) {
        try {
            // 1. On récupère les réglages personnalisés de l'utilisateur depuis SQLite
            const settings = await this.getSettings();
            
            // 2. On choisit le modèle dans l'ordre : paramètre > réglage BDD > defaultModel global
            const activeModel = modelOverride || settings.ai_model || defaultModel;
            
            // 3. On choisit la clé API : réglage BDD > fichier .env
            const apiKey = settings.api_key || process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY;

            if (!apiKey) {
                throw new Error("Clé API manquante dans le .env ou dans les paramètres du tableau de bord.");
            }

            // 4. Appel à l'API (Compatible OpenRouter et NVIDIA NIM)
            const response = await axios.post(
                "https://integrate.api.nvidia.com/v1/chat/completions", // Si tu utilises l'URL directe de NVIDIA, remplace-la ici
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
                    timeout: 60000 // 60 secondes max pour laisser l'IA lire le texte
                }
            );

            return response.data.choices[0].message.content;

        } catch (error) {
            console.error(`❌ Erreur API IA (${error.config?.data ? JSON.parse(error.config.data).model : 'modèle inconnu'}) :`, error.response?.data?.error?.message || error.message);
            throw error;
        }
    }

    /**
     * NOUVEAU : APPEL À L'IA DE VISION (Pour lire les Graphiques, Courbes et Tableaux)
     */
    static async askVisionAI(prompt, base64Image) {
        const API_URL = process.env.AI_API_URL;
        const API_KEY = process.env.AI_API_KEY;
        const visionModel = "meta/llama-3.2-90b-vision-instruct"; // Le modèle Vision de NVIDIA

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

    /**
     * PIPELINE D'ANALYSE (Texte + Vision)
     */
    static async analyzeArticle(filePath) {
        Logger.log(`🤖 Initialisation de l'Agent Lecteur pour : ${filePath}`);
        
        // 1. LECTURE DU TEXTE BRUT
        const fullText = await fs.readFile(filePath, 'utf8');
        const chunks = this.chunkText(fullText);
        const defaultModel = "meta/llama-3.1-70b-instruct";

        // ─── PASSE 1 : EXTRACTION MÉTADONNÉES ───
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

        const extractedMeta = await this.askAI(metadataPrompt, "Tu es expert en extraction JSON.", defaultModel);

        // ─── PASSE 2 : LECTURE DU TEXTE ET PRISES DE NOTES ───
        let allNotes = [];
        Logger.log(`  📝 [Lecture] Analyse textuelle approfondie (${chunks.length} segments)...`);
        
        // On limite à 2 chunks max pour gagner du temps et de l'argent sur le texte brut
        const maxChunks = Math.min(chunks.length, 2); 
        for (let index = 0; index < maxChunks; index++) {
            const chunkPrompt = `Prends des notes détaillées sur ce passage. Extrais impérativement les résultats chiffrés majeurs, les conclusions et les limites mentionnées.\n\nTexte du segment :\n\n${chunks[index]}`;
            const segmentNotes = await this.askAI(chunkPrompt, "Tu es un chercheur scientifique rigoureux.", defaultModel);
            allNotes.push(`--- Notes Texte (Segment ${index + 1}) ---\n${segmentNotes}`);
        }

        // ─── PASSE 2.5 : L'ANALYSE MULTIMODALE (VISION DES GRAPHIQUES) ───
        // Au lieu de lire tout le PDF, on ne regarde que les pages 2, 3, 4 et 5 (C'est là que sont les tableaux de résultats à 90%)
        // ─── PASSE 2.5 : L'ANALYSE MULTIMODALE (VISION DES GRAPHIQUES) ───
        Logger.log(`  👁️ [Vision IA] Vérification du PDF pour l'analyse multimodale...`);
        
        try {
            const pdfFilePath = filePath.replace('.txt', '.pdf'); 
            
            // 1. SÉCURITÉ : On vérifie que le PDF existe bien (Évite l'erreur ENOENT)
            if (!fsSync.existsSync(pdfFilePath)) {
                Logger.log(`  ⏭️ [Vision IA] Ignoré : Aucun fichier PDF complet pour cet article (Abstract uniquement).`);
            } else {
                Logger.log(`  👁️ [Vision IA] PDF détecté. Extraction des pages statistiques (2 à 5)...`);
                
                const imageDir = path.dirname(pdfFilePath);
                const baseName = path.basename(pdfFilePath, '.pdf');
                
                // 2. APPEL À LINUX : On utilise 'pdftoppm' pour extraire les pages 2 à 5 en format JPEG
                try {
                    // -f 2 (first page), -l 5 (last page)
                    execSync(`pdftoppm -f 2 -l 5 -jpeg "${pdfFilePath}" "${path.join(imageDir, baseName)}"`);
                } catch (e) {
                    Logger.log(`  ⚠️ [Vision IA] Le PDF est probablement trop court, extraction partielle.`);
                }

                // 3. LECTURE DES IMAGES : On trouve toutes les images générées par Linux
                const generatedFiles = fsSync.readdirSync(imageDir).filter(f => f.startsWith(baseName + '-') && f.endsWith('.jpg'));

                for (const file of generatedFiles) {
                    const imgPath = path.join(imageDir, file);
                    Logger.log(`     -> Scan visuel du fichier ${file}...`);
                    
                    const imgBuffer = await fs.readFile(imgPath);
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

                    // 4. NETTOYAGE : On supprime l'image JPEG pour ne pas saturer le disque dur
                    await fs.unlink(imgPath);
                }
            }
        } catch (visionErr) {
            Logger.log(`  ⚠️ [Vision IA] Échec de l'analyse visuelle : ${visionErr.message}`);
        }

        // ─── PASSE 3 : SYNTHÈSE GLOBALE DE L'ARTICLE ───
        Logger.log(`  🧠 [Synthèse] Génération de la synthèse structurée finale...`);
        const synthesisPrompt = `En te basant exclusivement sur tes notes de lecture suivantes, rédige une synthèse structurée de l'article incluant : les objectifs, les données clés, les conclusions et les limites de l'étude.

Notes accumulées (Texte + Vision) :\n\n${allNotes.join('\n')}`;

        const articleSynthesis = await this.askAI(synthesisPrompt, "Tu es un analyste de données scientifiques.", defaultModel);

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
            const response = await this.askAI(prompt, "Tu es un extracteur JSON strict.", "meta/llama-3.1-70b-instruct");
            const match = response.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]).slice(0, 3);
            return [];
        } catch (error) {
            return [];
        }
    }

    static async getSettings() {
        return new Promise((resolve) => {
            db.get("SELECT api_key, ai_model FROM user_settings WHERE id = 1", (err, row) => {
                if (err || !row) resolve({ api_key: null, ai_model: null });
                else resolve(row);
            });
        });
    }
}

module.exports = AiReaderService;