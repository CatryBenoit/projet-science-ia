const axios = require('axios');
const _pdfParseRaw = require('pdf-parse');
// pdf-parse expose parfois la fonction en .default, parfois directement
const pdfParse = typeof _pdfParseRaw === 'function'
    ? _pdfParseRaw
    : (typeof _pdfParseRaw?.default === 'function' ? _pdfParseRaw.default : null);
if (!pdfParse) throw new Error('pdf-parse introuvable — vérifie ton npm install');
const fs = require('fs').promises;
const path = require('path');
const db = require('../../config/db');
const AggregatorService = require('./aggregator.service');
const SciHubService = require('../providers/scihub.service');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const AiReaderService = require('./ai-reader.service');
const Logger = require('../app_Service/logger.service'); 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, 5000));
const jitter = (base, range) => base + Math.floor(Math.random() * range);
const ArticleModel = require('../../Models/article.model');
const ProjectModel = require('../../Models/project.model');
const SettingsModel = require('../../Models/setting.model');
const { articleQueue } = require('../app_Service/queue.service');


// ─── Config ───────────────────────────────────────────────────────────────────
const UNPAYWALL_EMAIL = 'votre@email.com'; // ← Remplace par ton email
const BATCH_SIZE = 3;

// ─── User-Agents réalistes ────────────────────────────────────────────────────
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const buildHeaders = (ua) => ({
    'User-Agent': ua,
    'Accept': 'application/pdf,text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://scholar.google.com/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'max-age=0',
});

// ─── Vérifie qu'un buffer est bien un PDF ─────────────────────────────────────
const isPDF = (buf) => Buffer.isBuffer(buf) && buf.slice(0, 5).toString() === '%PDF-';

class ResearchServiceMassive {

    static async getUnpaywallPdfUrl(article) {
        const doi = article.doi;
        if (!doi) {
            Logger.log(`  ⏭️  Pas de DOI — skip Unpaywall`);
            return null;
        }

        try {
            const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${UNPAYWALL_EMAIL}`;
            const { data } = await axios.get(url, { timeout: 10000 });

            const locations = data?.oa_locations || [];
            if (data?.best_oa_location) locations.unshift(data.best_oa_location);

            const seen = new Set();
            const sorted = locations
                .filter(loc => {
                    const u = loc?.url_for_pdf || loc?.url;
                    if (!u || seen.has(u)) return false;
                    seen.add(u);
                    return true;
                })
                .sort((a, b) => {
                    const score = (l) => l?.host_type === 'repository' ? 0 : 1;
                    return score(a) - score(b);
                });

            if (sorted.length === 0) {
                Logger.log(`  🔒 Unpaywall : aucun PDF OA trouvé`);
                return null;
            }

            const urls = sorted.map(l => l?.url_for_pdf || l?.url).filter(Boolean);
            Logger.log(`  🔓 Unpaywall : ${urls.length} URL(s) OA trouvée(s) [priorité repository]`);
            return urls;
        } catch (err) {
            if (err.response?.status === 404) {
                Logger.log(`  ⚠️  Unpaywall : DOI non référencé`);
            } else {
                Logger.log(`  ⚠️  Unpaywall : ${err.message}`);
            }
            return null;
        }
    }

    static async downloadWithAxios(url) {
        const ua = randomUA();
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 45000,
            maxRedirects: 5,
            headers: buildHeaders(ua),
        });
        const buf = Buffer.from(response.data);
        if (!isPDF(buf)) throw new Error('NOT_PDF');
        return buf;
    }

    static async downloadWithPuppeteer(url) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080',
                ],
                defaultViewport: { width: 1920, height: 1080 },
            });

            const page = await browser.newPage();
            await page.setUserAgent(randomUA());
            await page.setExtraHTTPHeaders(buildHeaders(randomUA()));

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en'] });
            });

            let pdfBuffer = null;
            page.on('response', async (res) => {
                const ct = res.headers()['content-type'] || '';
                if (ct.includes('pdf') || res.url().endsWith('.pdf')) {
                    try { pdfBuffer = await res.buffer(); } catch (_) { }
                }
            });

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
            await page.mouse.move(jitter(300, 400), jitter(200, 300));
            await sleep(jitter(500, 1000));

            if (pdfBuffer && isPDF(pdfBuffer)) return pdfBuffer;
            throw new Error('Puppeteer : PDF non intercepté');
        } finally {
            if (browser) await browser.close();
        }
    }

    static async downloadArticle(article) {
        const oaUrls = await this.getUnpaywallPdfUrl(article);
        if (oaUrls?.length) {
            for (const oaUrl of oaUrls) {
                try {
                    const buf = await this.downloadWithAxios(oaUrl);
                    Logger.log(`  🟢 PDF complet via Unpaywall → ${oaUrl.substring(0, 50)}...`);
                    return { buffer: buf, method: 'unpaywall_axios' };
                } catch (e) {
                    Logger.log(`  ⚠️  Unpaywall Axios échoué [${e.message}]`);
                }
            }
        }

        if (article.doi) {
            try {
                Logger.log(`  🏴‍☠️ Tentative Sci-Hub pour le DOI: ${article.doi}...`);
                const buf = await SciHubService.fetchPdfBuffer(article.doi);
                if (buf && isPDF(buf)) {
                    Logger.log(`  🟢 PDF complet via Sci-Hub`);
                    return { buffer: buf, method: 'scihub' };
                }
            } catch (e) {
                Logger.log(`  ⚠️  Sci-Hub échoué (${e.message})`);
            }
        }

        if (article.oa_url) {
            try {
                const buf = await this.downloadWithAxios(article.oa_url);
                Logger.log(`  🟢 PDF complet via URL originale`);
                return { buffer: buf, method: 'original_axios' };
            } catch (e) {
                Logger.log(`  ⚠️  Axios original échoué (${e.message})`);
            }
        }

        const puppeteerUrl = oaUrls?.[0] || article.oa_url;
        if (puppeteerUrl) {
            try {
                Logger.log(`  🛡️ Déploiement Puppeteer pour ${puppeteerUrl.substring(0, 40)}...`);
                const buf = await this.downloadWithPuppeteer(puppeteerUrl);
                Logger.log(`  🟢 PDF complet via Puppeteer`);
                return { buffer: buf, method: 'puppeteer' };
            } catch (e) {
                Logger.log(`  ⚠️  Puppeteer échoué (${e.message})`);
            }
        }

        Logger.log(`  🔴 Repli sur abstract uniquement`);
        return { buffer: null, method: 'abstract_only' };
    }

static async startMassiveResearch(query, amount, projectId, depth = 0) {
        const uniqueArticles = await AggregatorService.searchAndMerge(query, amount);
        if (uniqueArticles.length > 0) {
           
            await this.processMassiveDownloads(uniqueArticles, query, projectId, depth);
        } else {
            Logger.log("Aucun article trouvé.");
        }
    }

static async processMassiveDownloads(articles, query, projectId, depth = 0) {
        const fs = require('fs').promises;
        const path = require('path');
        const Logger = require('../app_Service/logger.service');
        
        // ⚠️ IMPORT IMPORTANT : On importe la boîte aux lettres (File d'attente)
        const { articleQueue } = require('../app_Service/queue.service'); 

        Logger.log(`\n🚀 Démarrage — Création de ${articles.length} tickets de traitement dans Redis...`);

        const storageDir = path.resolve(__dirname, '../data/articles');
        await fs.mkdir(storageDir, { recursive: true });

        // Fini les lots (BATCH_SIZE) et les pauses aléatoires !
        // On boucle simplement sur tous les articles pour créer un ticket par article.
        for (const article of articles) {
            const shortTitle = article.title?.substring(0, 40) || 'Sans titre';
            
            // On glisse toutes les infos nécessaires dans le "ticket" (job)
            await articleQueue.add('analyze-article', {
                article: article,
                query: query,
                projectId: projectId,
                storageDir: storageDir,
                depth: depth
            });
            
            Logger.log(` 🎫 Ticket généré pour : "${shortTitle}..."`);
        }

        Logger.log(`\n🏁 Tous les tickets ont été déposés dans la file d'attente !`);
        Logger.log(`Le Worker va maintenant les traiter 1 par 1 en arrière-plan.`);

    }
static async generateAutoSynthesis(projectId, depth = 0) {
        try {
            // 1. Récupération propre des données via le Modèle
            const rows = await ProjectModel.getAnalyzedArticles(projectId);

            if (!rows || rows.length === 0) {
                Logger.log("⚠️ Impossible de faire la synthèse : aucun article analysé.");
                return;
            }

            // 2. Formatage des données pour l'IA
            let aggregatedData = rows.map((r, i) => {
                let scoreText = "⭐⭐⭐ (Non noté)";
                let studyType = "Inconnu";
                try {
                    const meta = JSON.parse(r.metadata);
                    if (meta.quality_score) scoreText = '⭐'.repeat(meta.quality_score);
                    if (meta.study_type) studyType = meta.study_type;
                } catch (e) { }

                return `### ÉTUDE ${i + 1} : ${r.title} \n[Type: ${studyType} | Fiabilité: ${scoreText}]\n${r.synthesis}\n`;
            }).join('\n');

            if (aggregatedData.length > 60000) {
                aggregatedData = aggregatedData.substring(0, 60000) + "\n[... Tronqué ...]";
            }

            // 3. Appel à l'IA pour la Méta-analyse
            const systemPrompt = `Tu es Directeur de Recherche. Fais une méta-analyse et une synthèse transversale (Markdown) de ces études. 
Règle Absolue : Tu dois pondérer tes conclusions en fonction de la Fiabilité (les étoiles ⭐) de chaque étude. Les affirmations issues d'études à 4 ou 5 étoiles doivent primer sur celles à 1 ou 2 étoiles en cas de contradiction.

Format attendu: 
1. 🔬 Contexte Global
2. ⚖️ Poids des Preuves (Analyse de la qualité globale des études fournies)
3. 🤝 Consensus Scientifique (Basé principalement sur les études haute fiabilité)
4. ⚔️ Contradictions
5. 🔍 Lacunes de la littérature.`;

            const finalReport = await AiReaderService.askAI(aggregatedData, systemPrompt, "meta/llama-3.1-70b-instruct");

            // 4. Sauvegarde propre via le Modèle
            await ProjectModel.saveSynthesis(projectId, finalReport);
            Logger.log(`🎉 MÉGA-SYNTHÈSE TERMINÉE ! Le rapport du projet #${projectId} a été mis à jour.`);

            // 5. Boucle d'Auto-Inspiration (Agentique)
            const MAX_DEPTH = 3; // L'IA peut relancer jusqu'à 3 niveaux de recherche.

            if (depth < MAX_DEPTH) {
                Logger.log(`\n💡 L'IA réfléchit aux zones d'ombre de sa propre synthèse...`);
                const newQueries = await AiReaderService.generateInspirationQueries(finalReport);

                if (newQueries.length > 0) {
                    Logger.log(`  🎯 Eurêka ! L'IA veut approfondir ces sujets : ${JSON.stringify(newQueries)}`);

                    for (const query of newQueries) {
                        Logger.log(`\n🚀 [Auto-Pilote] L'IA lance une recherche sur : "${query}"`);
                        const newArticles = await AggregatorService.searchAndMerge(query, 3);
                        
                        if (newArticles.length > 0) {
                            await this.processMassiveDownloads(newArticles, projectId, depth + 1);
                        }
                    }
                } else {
                    Logger.log(`  🛑 L'IA estime que le sujet est suffisamment couvert.`);
                }
            } else {
                Logger.log(`  🛡️ Arrêt de l'Auto-Inspiration (Profondeur maximale atteinte).`);
            }

        } catch (err) {
            Logger.log(`🔴 Échec de la synthèse ou de l'auto-inspiration : ${err.message}`);
        }
    }


 static async filterAndQueueSubtopics(project, parentDocId, rawProposedSubtopics, currentDepth) {
  const rootTopic = project.title; // Ou une colonne spécifique 'root_topic' de ton projet
  
  const nextIterationQueue = [];
  const prunedBranches = [];

  // 1. Évaluation asynchrone et parallèle de toutes les pistes générées
  const evaluationPromises = rawProposedSubtopics.map(subtopic => 
    evaluateRelevance(rootTopic, subtopic, currentDepth)
  );
  
  const evaluations = await Promise.all(evaluationPromises);

  // 2. Tri des branches selon la décision du Guardrail
  for (let i = 0; i < evaluations.length; i++) {
    const evalResult = evaluations[i];
    const subtopic = rawProposedSubtopics[i];
    
    // Objet de base pour ta base de données
    const nodeData = {
      project_id: project.id,
      parent_doc_id: parentDocId,
      topic: subtopic,
      relevance_score: evalResult.relevance_score,
      reasoning: evalResult.chain_of_thought,
      depth: currentDepth + 1,
      created_at: new Date().toISOString()
    };

    // 3. Double sécurité : On vérifie la décision ET le score minimum de 7/10
    if (evalResult.decision === "KEEP" && evalResult.relevance_score >= 7) {
      nodeData.status = 'PENDING'; // Prêt à être exploré à l'itération suivante
      nextIterationQueue.push(nodeData);
    } else {
      nodeData.status = 'PRUNED'; // Branche coupée par l'IA
      prunedBranches.push(nodeData);
    }

    // 4. Enregistrement en base de données (pour alimenter ton futur graphe visuel)
    await db.saveResearchNode(nodeData); 
  }

  // Log dans le terminal ou ton système de logs (logger.service.js)
  console.log(`[Anti-Dérive] Itération ${currentDepth} : ${nextIterationQueue.length} pistes validées, ${prunedBranches.length} branches élaguées.`);

  return {
    validTopics: nextIterationQueue,
    prunedTopics: prunedBranches
  };
}


/**
     *  NOUVEAU : CYCLE DE RÉFLEXION (COPILOTE / AUTO)
     * Remplace l'ancienne boucle for. Est appelé à chaque fin de cycle.
     */
static async launchAutonomousLoop(projectId, currentDepth = 0) {
        const AiReaderService = require('./ai-reader.service');
        const ProjectModel = require('../../Models/project.model');
        const SettingsModel = require('../../Models/setting.model');
        const Logger = require('../app_Service/logger.service');

        try {
            // 1. Vérification de la limite d'itérations
            const settings = await SettingsModel.getSettings() || {};
            const maxIterations = settings.max_iterations || 2;

            if (currentDepth >= maxIterations) {
                Logger.log(`🏁 [AGENT AUTONOME] Profondeur maximale atteinte (${maxIterations}). Projet terminé.`);
                await ProjectModel.updateStatus(projectId, 'COMPLETED');
                return;
            }

            // 2. Récupérer l'état du projet depuis la BDD
            const projectData = await ProjectModel.getProjectWithSynthesis(projectId);
            
            if (!projectData) {
                Logger.log(`❌ [AGENT AUTONOME] Projet #${projectId} introuvable.`);
                return;
            }

            // Si un humain a déjà mis le projet en pause, on ne fait rien
            if (projectData.status === 'PAUSED') {
                Logger.log(`⏸️ [AGENT AUTONOME] Projet en pause. J'attends les ordres de l'humain.`);
                return;
            }

            Logger.log(`\n🔄 ═══ RÉFLEXION POUR L'ITÉRATION ${currentDepth + 1}/${maxIterations} ═══`);

            const currentSynthesis = projectData.report || `Projet : ${projectData.name}`;
            const ignoredTopics = JSON.parse(projectData.ignored_topics || '[]');

            // 3. L'IA analyse les lacunes et propose des pistes
            Logger.log(`🧠 [AGENT AUTONOME] Recherche de nouvelles hypothèses dans les zones d'ombre...`);
            let queries = await AiReaderService.generateInspirationQueries(currentSynthesis);

            if (!queries || queries.length === 0) {
                Logger.log(`⏹️ [AGENT AUTONOME] Le sujet semble entièrement couvert. Arrêt naturel.`);
                await ProjectModel.updateStatus(projectId, 'COMPLETED');
                return;
            }

            // 4. GUARDRAIL : Élimination des pistes bannies
            const validQueries = queries.filter(q => {
                const isIgnored = ignoredTopics.some(ignored => q.toLowerCase().includes(ignored.toLowerCase()));
                if (isIgnored) Logger.log(`  ✂️ [GUARDRAIL] Piste "${q}" rejetée (Branche élaguée).`);
                return !isIgnored;
            });

            if (validQueries.length === 0) {
                Logger.log(`⏹️ [AGENT AUTONOME] Toutes les nouvelles pistes sont bannies. Fin de l'exploration.`);
                await ProjectModel.updateStatus(projectId, 'COMPLETED');
                return;
            }

            Logger.log(`🎯 [AGENT AUTONOME] ${validQueries.length} piste(s) proposée(s) : [ ${validQueries.join(', ')} ]`);

            // ==========================================
            // 🚦 LE CARREFOUR DÉCISIF : COPILOTE OU AUTO ?
            // ==========================================
            
            if (projectData.copilot_mode === 1) {
                // 🛑 FEU ROUGE : Mode Jour (Copilote)
                Logger.log(`🛑 [MODE COPILOTE] Mise en pause du processus.`);
                Logger.log(`     -> Sauvegarde des idées dans la salle d'attente (pending_queries).`);
                Logger.log(`     -> En attente de la validation du chercheur sur l'interface...`);
                
                await ProjectModel.savePendingQueries(projectId, validQueries, currentDepth + 1);
                await ProjectModel.updateStatus(projectId, 'PAUSED');
                
            } else {
                // 🟢 FEU VERT : Mode Nuit (100% Autonome)
                Logger.log(`🟢 [MODE NUIT] Copilote désactivé. J'explore ces pistes immédiatement !`);
                
                for (const query of validQueries) {
                    Logger.log(`🌐 Injection de la requête : "${query}" dans la file d'attente...`);
                    // On envoie le travail à notre système de téléchargement massif
                    await this.startMassiveResearch(query, 3, projectId, currentDepth + 1);
                }
            }

        } catch (error) {
            Logger.log(`❌ [AGENT AUTONOME] Erreur critique : ${error.message}`);
        }
    }



}
module.exports = ResearchServiceMassive;