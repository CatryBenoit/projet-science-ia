const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

const Logger = require('./logger.service');
const AiReaderService = require('../IA_service/ai-reader.service');
const ArticleModel = require('../../Models/article.model');

// Configuration de la connexion Redis (par défaut sur le port 6379)
const connection = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

// 1. CRÉATION DE LA FILE D'ATTENTE
const articleQueue = new Queue('article-analysis', { connection });

// 2. CRÉATION DE L'OUVRIER (WORKER)
// concurrency: 1 signifie qu'il traite STRICTEMENT 1 article à la fois (adieu les Timeout d'API !)
const worker = new Worker('article-analysis', async (job) => {
    const { article, query, projectId, storageDir } = job.data;
    const safeId = article.id.replace(/[^a-zA-Z0-9]/g, '_') + '_proj' + projectId;
    const filePath = path.join(storageDir, `${safeId}.txt`);
    
    Logger.log(`\n🎟️ [TICKET EN COURS] Traitement de l'article : "${article.title?.substring(0, 40)}..."`);

    // --- 🛡️ L'AGENT VIDEUR ---
    const evaluation = await AiReaderService.evaluateArticleRelevance(
        query, article.title, article.abstract || article.description || ""
    );

    if (evaluation.decision === "PRUNE") {
        Logger.log(` 🚫 [REJETÉ] HORS-SUJET (${evaluation.score}/10) : ${evaluation.reasoning}`);
        return; // Fin du ticket, on passe au suivant !
    }
    Logger.log(` ✅ [VALIDÉ] (${evaluation.score}/10) : ${evaluation.reasoning}`);

    // Ici, on importe dynamiquement ResearchServiceMassive pour éviter les boucles circulaires
    const ResearchService = require('../IA_service/research.service'); 
    const { buffer, method } = await ResearchService.downloadArticle(article);
    
    let textToSave = '';
    let isValidForSave = false;

    // CAS 1 : PDF complet
    if (buffer && buffer.length > 0) { 
        const pdfFilePath = path.join(storageDir, `${safeId}.pdf`);
        await fs.writeFile(pdfFilePath, buffer);
        try {
            const parsed = await pdfParse(buffer);
            textToSave = parsed.text.replace(/\n\s*\n/g, '\n').trim();
            isValidForSave = true;
        } catch (e) {
            Logger.log(`  ⚠️ Erreur de parsing PDF, repli sur l'abstract.`);
        }
    } 
    
    // CAS 2 : Abstract uniquement
    if (!isValidForSave && article.abstract && article.abstract.trim().length > 20) {
        textToSave = `TITLE: ${article.title}\nABSTRACT:\n${article.abstract.trim()}`;
        isValidForSave = true;
    }

    if (!isValidForSave) throw new Error("Aucun contenu exploitable.");

    // --- SAUVEGARDE ET INTELLIGENCE ARTIFICIELLE ---
    if (isValidForSave && textToSave.length > 50) {
        await fs.writeFile(filePath, textToSave, 'utf8');
        await ArticleModel.saveArticle({
            id: safeId, title: article.title, published_date: article.published_date,
            oa_url: article.oa_url, local_file_path: filePath, project_id: projectId, type: article.type || 'academic'
        });

        Logger.log(`  🧠 [IA] Lancement de l'analyse (Texte + Vision)...`);
        const analysis = await AiReaderService.analyzeArticle(filePath);

        await ArticleModel.saveAnalysis({
            article_id: safeId, metadata: analysis.meta, notes: analysis.notes, synthesis: analysis.synthesis
        });
        Logger.log(`  ✅ [IA] Analyse terminée et sauvegardée en BDD.`);
    }

}, { connection, concurrency: 1 });

// 3. GESTION DE LA FIN DU LOT (Quand la file est vide)
const queueEvents = new QueueEvents('article-analysis', { connection });
queueEvents.on('drained', async () => {
    Logger.log(`\n👑 [FILE VIDE] Tous les tickets ont été traités ! Lancement de la méta-synthèse globale...`);
    const ResearchService = require('../IA_service/research.service');
    // On lance la synthèse (attention à passer les bons IDs si besoin, ici on simplifie)
    // ResearchService.generateAutoSynthesis(projectId, depth); 
});

module.exports = { articleQueue };