const LibraryService = require('../services/app_Service/library.service');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const AiReaderService = require('../services/IA_service/ai-reader.service');
const { YoutubeTranscript } = require('youtube-transcript');

class LibraryController {
    
    
    static async getArticles(req, res) {
        try {
            const articles = await LibraryService.getAllArticles();
            res.json(articles);
        } catch (error) {
            res.status(500).json({ error: "Erreur lors de la récupération de la bibliothèque." });
        }
    }

    static async getProjectArticles(req, res) {
        try {
            const { projectId } = req.params;
            const articles = await LibraryService.getArticlesByProject(projectId);
            res.json(articles);
        } catch (error) {
            res.status(500).json({ error: "Erreur BDD" });
        }
    }

    static async getArticleContent(req, res) {
        try {
            const { id } = req.params;
            const content = await LibraryService.getArticleContent(id);
            res.json({ content });
        } catch (error) {
            const status = error.message.includes("introuvable") ? 404 : 500;
            res.status(status).json({ error: error.message });
        }
    }

    static async analyzeArticle(req, res) {
        try {
            const { id } = req.params;
            const analysis = await LibraryService.analyzeArticle(id);
            res.json({ message: "Analyse terminée !", analysis });
        } catch (error) {
            const status = error.message.includes("introuvable") ? 404 : 500;
            res.status(status).json({ error: error.message === "Article introuvable." ? error.message : "Échec de l'analyse IA." });
        }
    }

    static async getArticleAnalysis(req, res) {
        try {
            const { id } = req.params;
            const analysis = await LibraryService.getArticleAnalysis(id);
            res.json(analysis);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

static async uploadArticle(req, res) {
        try {
            const projectId = req.params.id;
            const file = req.file;
            const userId = req.user?.id || req.userId || 1;

            if (!file) {
                return res.status(400).json({ error: "Aucun fichier n'a été reçu." });
            }

            const filePath = file.path;
            const title = file.originalname;
            const publishedDate = new Date().toISOString().split('T')[0];

            const db = require('../config/db');

            // 1. M-A-J AUTOMATIQUE DE LA BDD (On s'assure que toutes les colonnes existent)
            await new Promise(resolve => db.run(`ALTER TABLE articles ADD COLUMN file_path TEXT`, () => resolve()));
            await new Promise(resolve => db.run(`ALTER TABLE articles ADD COLUMN metadata TEXT`, () => resolve()));
            await new Promise(resolve => db.run(`ALTER TABLE articles ADD COLUMN synthesis TEXT`, () => resolve()));
            await new Promise(resolve => db.run(`ALTER TABLE articles ADD COLUMN notes TEXT`, () => resolve()));

            // 2. On insère l'article en base de données
            const articleId = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO articles (project_id, title, type, file_path, published_date) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [projectId, title, 'academic', filePath, publishedDate],
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.lastID); 
                    }
                );
            });

            // 3. 🚀 RÉPONSE IMMÉDIATE AU FRONTEND
            // On n'attend pas la fin de l'analyse IA pour répondre à l'utilisateur, sinon la page va figer.
            res.status(201).json({ message: "Fichier ajouté ! L'IA l'analyse en arrière-plan...", file: title });

            // ==========================================
            // 🤖 4. LANCER L'ANALYSE IA EN ARRIÈRE-PLAN
            // ==========================================
            (async () => {
                try {
                    console.log(`\n⏳ [PROCESSUS IA] Extraction du texte pour : ${title}`);
                    
                    // Extraire le texte du PDF
                    const dataBuffer = fs.readFileSync(filePath);
                    const pdfData = await pdfParse(dataBuffer);
                    const extractedText = pdfData.text;

                    // Créer le fichier .txt attendu par ton AiReaderService
                    const txtFilePath = filePath.replace('.pdf', '.txt');
                    await fsPromises.writeFile(txtFilePath, extractedText);

                    // Lancer la flotte d'agents IA (Archiviste, Chercheur, Réviseur, Éditeur...)
                    console.log(`🤖 [PROCESSUS IA] Lancement des agents sur : ${title}`);
                    const aiResult = await AiReaderService.analyzeArticle(txtFilePath, userId);

                    // Sauvegarder les résultats de l'IA dans la base de données
                    const metaString = typeof aiResult.meta === 'string' ? aiResult.meta : JSON.stringify(aiResult.meta);
                    
                    db.run(
                        `UPDATE articles SET metadata = ?, synthesis = ?, notes = ? WHERE id = ?`,
                        [metaString, aiResult.synthesis, aiResult.notes, articleId]
                    );

                    console.log(`✅ [PROCESSUS IA] Analyse terminée et sauvegardée pour : ${title}\n`);
                    
                } catch (bgError) {
                    console.error(`❌ [PROCESSUS IA] Erreur en arrière-plan pour ${title} :`, bgError.message);
                }
            })();

        } catch (error) {
            console.error("Erreur lors de l'upload :", error);
            res.status(500).json({ error: "Une erreur est survenue lors de l'enregistrement du document." });
        }
    }

    // 🎥 NOUVELLE MÉTHODE : Importer et transcrire une vidéo YouTube
    static async addVideoLink(req, res) {
        try {
            const projectId = req.params.id;
            const { url } = req.body;
            const userId = req.user?.id || req.userId || 1;

            if (!url || !url.includes('youtu')) {
                return res.status(400).json({ error: "Un lien YouTube valide est requis." });
            }

            const db = require('../config/db');

            // 1. Extraction de la transcription depuis YouTube
            let transcript;
            try {
                transcript = await YoutubeTranscript.fetchTranscript(url);
            } catch (err) {
                return res.status(400).json({ error: "Impossible d'extraire les sous-titres de cette vidéo (elle n'en possède peut-être pas ou est privée)." });
            }

            // 2. Reconstruire le texte complet
            const fullText = transcript.map(t => t.text).join(' ');

            // 3. Sauvegarder le texte dans un fichier .txt local
            const fileName = `Video_Transcript_${Date.now()}.txt`;
            const filePath = path.join(__dirname, '../services/data/articles/', fileName);
            await fsPromises.writeFile(filePath, fullText);

            // 4. M-A-J AUTOMATIQUE DE LA BDD (On s'assure que la colonne oa_url existe pour stocker le lien)
            await new Promise(resolve => db.run(`ALTER TABLE articles ADD COLUMN oa_url TEXT`, () => resolve()));

            const publishedDate = new Date().toISOString().split('T')[0];
            const title = "🎥 Vidéo YouTube (En cours d'analyse...)";

            // 5. Insertion en base de données (Type "testimony" pour le classer dans le bon tableau)
            const articleId = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO articles (project_id, title, type, file_path, published_date, oa_url) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [projectId, title, 'testimony', filePath, publishedDate, url],
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.lastID); 
                    }
                );
            });

            // 6. Réponse immédiate au Front
            res.status(201).json({ message: "Vidéo importée ! L'IA écoute et analyse la conférence..." });

            // 7. Lancement de l'IA en arrière-plan
            (async () => {
                try {
                    console.log(`\n⏳ [PROCESSUS IA] Analyse de la vidéo : ${url}`);
                    
                    const aiResult = await AiReaderService.analyzeArticle(filePath, userId);
                    const metaString = typeof aiResult.meta === 'string' ? aiResult.meta : JSON.stringify(aiResult.meta);
                    
                    // On met à jour le titre avec celui trouvé par l'IA (s'il y en a un)
                    let newTitle = "🎥 Vidéo YouTube Analysée";
                    try {
                        const parsedMeta = JSON.parse(metaString);
                        if (parsedMeta.titre) newTitle = `🎥 ${parsedMeta.titre}`;
                    } catch(e) {}

                    db.run(
                        `UPDATE articles SET title = ?, metadata = ?, synthesis = ?, notes = ? WHERE id = ?`,
                        [newTitle, metaString, aiResult.synthesis, aiResult.notes, articleId]
                    );

                    console.log(`✅ [PROCESSUS IA] Vidéo analysée avec succès !\n`);
                } catch (bgError) {
                    console.error(`❌ [PROCESSUS IA] Erreur vidéo en arrière-plan :`, bgError.message);
                }
            })();

        } catch (error) {
            console.error("Erreur addVideoLink:", error);
            res.status(500).json({ error: "Erreur serveur lors de l'ajout de la vidéo." });
        }
    }
}

module.exports = LibraryController;