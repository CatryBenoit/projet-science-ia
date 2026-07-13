const axios = require('axios');
const _pdfParseRaw = require('pdf-parse');
// pdf-parse expose parfois la fonction en .default, parfois directement
const pdfParse = typeof _pdfParseRaw === 'function'
    ? _pdfParseRaw
    : (typeof _pdfParseRaw?.default === 'function' ? _pdfParseRaw.default : null);
if (!pdfParse) throw new Error('pdf-parse introuvable — vérifie ton npm install');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/db');
const AggregatorService = require('./aggregator.service');
const SciHubService = require('./providers/scihub.service');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const AiReaderService = require('./ai-reader.service');
const Logger = require('./logger.service'); // LE MÉGAPHONE DU TERMINAL

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const jitter = (base, range) => base + Math.floor(Math.random() * range);

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
            await this.processMassiveDownloads(uniqueArticles, projectId, depth);
        } else {
            Logger.log("Aucun article trouvé.");
        }
    }

    static async processMassiveDownloads(articles, projectId, depth = 0) {
        Logger.log(`\n🚀 Démarrage — ${articles.length} articles à traiter (pipeline 5 niveaux)\n`);

        const storageDir = path.resolve(__dirname, '../data/articles');
        await fs.mkdir(storageDir, { recursive: true });

        const stats = { full: 0, abstract: 0, failed: 0 };

        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batch = articles.slice(i, i + BATCH_SIZE);
            const groupNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalGroups = Math.ceil(articles.length / BATCH_SIZE);
            Logger.log(`\n──────────── Groupe ${groupNum}/${totalGroups} ────────────`);

            await Promise.all(batch.map(async (article) => {
                // CORRECTION 1 : On ajoute l'ID du projet pour rendre cet article unique à ce projet précis
                const safeId = article.id.replace(/[^a-zA-Z0-9]/g, '_') + '_proj' + projectId;
                const filePath = path.join(storageDir, `${safeId}.txt`);
                const shortTitle = article.title?.substring(0, 40) || 'Sans titre';
                Logger.log(`\n📄 "${shortTitle}..."`);

                try {
                    const { buffer, method } = await this.downloadArticle(article);
                    let textToSave = '';
                    let isValidForSave = false; // 🛑 NOUVEAU : Notre verrou de sécurité

                    // CAS 1 : On a le PDF complet
                    if (buffer && isPDF(buffer)) {
                        const pdfFilePath = path.join(storageDir, `${safeId}.pdf`);
                        await fs.writeFile(pdfFilePath, buffer);
                        Logger.log(`  💾 PDF original sauvegardé avec succès sur le disque.`);

                        const parsed = await pdfParse(buffer);
                        textToSave = parsed.text.replace(/\n\s*\n/g, '\n').trim();
                        stats.full++;
                        isValidForSave = true; // On autorise la sauvegarde
                    }
                    // CAS 2 : Pas de PDF, mais on a un VRAI résumé (au moins 20 caractères)
                    else if (article.abstract && article.abstract.trim().length > 20) {
                        textToSave = [
                            `--- ABSTRACT ONLY [${method.toUpperCase()}] ---`,
                            `TITLE: ${article.title}`,
                            `DATE: ${article.published_date}`,
                            `SOURCE: ${article.source}`,
                            `DOI: ${article.doi || 'N/A'}`,
                            `URL: ${article.oa_url}`,
                            ``,
                            `ABSTRACT:`,
                            article.abstract.trim(),
                        ].join('\n');
                        stats.abstract++;
                        isValidForSave = true; // On autorise la sauvegarde
                    }
                    // CAS 3 : Ni PDF, ni Résumé exploitable
                    else {
                        Logger.log(`  🗑️ Article ignoré : PDF inaccessible et aucun résumé disponible.`);
                        stats.failed++;
                    }

                    // ─── SAUVEGARDE ET IA (Uniquement si l'article a été validé) ───
                    if (isValidForSave && textToSave.length > 50) {
                        // 1. Écriture du fichier texte brut
                        await fs.writeFile(filePath, textToSave, 'utf8');

                        // 2. Verrouillage de la base de données et INSERT OR REPLACE
                        await new Promise((resolve) => {
                            db.run(
                                `INSERT OR REPLACE INTO articles (id, title, published_date, oa_url, local_file_path, project_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [safeId, article.title, article.published_date, article.oa_url, filePath, projectId, article.type || 'academic'],
                                function (dbErr) {
                                    if (dbErr) {
                                        Logger.log(`  ❌ [BDD] Impossible d'enregistrer l'article : ${dbErr.message}`);
                                    } else {
                                        let typeLabel = '📄 Étude';
                                        if (article.type === 'testimony') typeLabel = '🗣️ Témoignage';
                                        if (article.type === 'dataset') typeLabel = '📊 Données Brutes';
                                        if (article.type === 'news') typeLabel = '📰 Actualité';
                                        
                                        Logger.log(`  💾 [BDD] ${typeLabel} enregistré et validé (ID: ${safeId}).`);
                                    }
                                    resolve();
                                }
                            );
                        });

                        // 3. Analyse de l'IA (Texte + Vision)
                        try {
                            Logger.log(`  🧠 Lancement de l'analyse IA (Texte + Vision)...`);
                            const analysis = await AiReaderService.analyzeArticle(filePath);

                            await new Promise((resolve) => {
                                db.run(
                                    `INSERT OR REPLACE INTO article_analysis (article_id, metadata, notes, synthesis) VALUES (?, ?, ?, ?)`,
                                    [safeId, analysis.meta, analysis.notes, analysis.synthesis],
                                    (analysisErr) => {
                                        if (analysisErr) Logger.log(`  ❌ [BDD] Erreur sauvegarde analyse : ${analysisErr.message}`);
                                        resolve();
                                    }
                                );
                            });
                            Logger.log(`  ✅ Analyse IA terminée et sauvegardée.`);
                        } catch (aiErr) {
                            Logger.log(`  🔴 Échec de l'analyse IA automatique : ${aiErr.message}`);
                        }
                    }

                } catch (err) {
                    stats.failed++;
                    Logger.log(`  🔴 Échec critique : ${err.message}`);
                }
            }));


            if (i + BATCH_SIZE < articles.length) {
                const delay = jitter(2000, 2000);
                Logger.log(`\n😴 Pause ${delay}ms avant le prochain groupe...`);
                await sleep(delay);
            }
        }

        Logger.log(`\n${'═'.repeat(50)}`);
        Logger.log(`🏁 Téléchargements et analyses individuelles terminés !`);
        Logger.log(`   ✅ Textes intégraux : ${stats.full}`);
        Logger.log(`${'═'.repeat(50)}\n`);

        Logger.log(`👑 Lancement automatique de la synthèse globale du projet...`);
        this.generateAutoSynthesis(projectId, depth);
    }

    static generateAutoSynthesis(projectId, depth = 0) {
        const query = `
            SELECT a.title, aa.metadata, aa.synthesis 
            FROM articles a JOIN article_analysis aa ON a.id = aa.article_id 
            WHERE a.project_id = ?
        `;

        db.all(query, [projectId], async (err, rows) => {
            if (err || !rows || rows.length === 0) return Logger.log("⚠️ Impossible de faire la synthèse.");

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

            if (aggregatedData.length > 60000) aggregatedData = aggregatedData.substring(0, 60000) + "\n[... Tronqué ...]";

            try {
                const systemPrompt = `Tu es Directeur de Recherche. Fais une méta-analyse et une synthèse transversale (Markdown) de ces études. 
Règle Absolue : Tu dois pondérer tes conclusions en fonction de la Fiabilité (les étoiles ⭐) de chaque étude. Les affirmations issues d'études à 4 ou 5 étoiles doivent primer sur celles à 1 ou 2 étoiles en cas de contradiction.

Format attendu: 
1. 🔬 Contexte Global
2. ⚖️ Poids des Preuves (Analyse de la qualité globale des études fournies)
3. 🤝 Consensus Scientifique (Basé principalement sur les études haute fiabilité)
4. ⚔️ Contradictions
5. 🔍 Lacunes de la littérature.`;

                const finalReport = await AiReaderService.askAI(aggregatedData, systemPrompt, "meta/llama-3.1-70b-instruct");

                db.run(`INSERT OR REPLACE INTO project_synthesis (project_id, report) VALUES (?, ?)`, [projectId, finalReport]);
                Logger.log(`🎉 MÉGA-SYNTHÈSE TERMINÉE ! Le rapport du projet #${projectId} a été mis à jour.`);

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
                    Logger.log(`  🛡️ Arrêt de l'Auto-Inspiration (Limite de profondeur atteinte).`);
                }

            } catch (err) {
                Logger.log(`🔴 Échec de la synthèse ou de l'auto-inspiration : ${err.message}`);
            }
        });
    }
}

module.exports = ResearchServiceMassive;