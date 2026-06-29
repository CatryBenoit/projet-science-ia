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
const SciHubService = require('./providers/scihub.service'); // 🏴‍☠️ IMPORT DE SCI-HUB ICI

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const AiReaderService = require('./ai-reader.service');

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

    // ══════════════════════════════════════════════════════════════════════════
    // OUTILS DE TÉLÉCHARGEMENT
    // ══════════════════════════════════════════════════════════════════════════
    static async getUnpaywallPdfUrl(article) {
        const doi = article.doi;
        if (!doi) {
            console.log(`  ⏭️  Pas de DOI — skip Unpaywall`);
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
                console.log(`  🔒 Unpaywall : aucun PDF OA trouvé`);
                return null;
            }

            const urls = sorted.map(l => l?.url_for_pdf || l?.url).filter(Boolean);
            console.log(`  🔓 Unpaywall : ${urls.length} URL(s) OA trouvée(s) [priorité repository]`);
            return urls;
        } catch (err) {
            if (err.response?.status === 404) {
                console.log(`  ⚠️  Unpaywall : DOI non référencé`);
            } else {
                console.log(`  ⚠️  Unpaywall : ${err.message}`);
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

    // ══════════════════════════════════════════════════════════════════════════
    // PIPELINE PRINCIPAL : Unpaywall → Sci-Hub → Axios(original) → Puppeteer → Abstract
    // ══════════════════════════════════════════════════════════════════════════
    static async downloadArticle(article) {

        // ── 1. Unpaywall (Axios) ───────────────
        const oaUrls = await this.getUnpaywallPdfUrl(article);
        if (oaUrls?.length) {
            for (const oaUrl of oaUrls) {
                try {
                    const buf = await this.downloadWithAxios(oaUrl);
                    console.log(`  🟢 PDF complet via Unpaywall → ${oaUrl.substring(0, 50)}...`);
                    return { buffer: buf, method: 'unpaywall_axios' };
                } catch (e) {
                    console.log(`  ⚠️  Unpaywall Axios échoué [${e.message}]`);
                }
            }
        }

        // ── 2. NOUVEAU : SCI-HUB (Le pirate) ───────────────
        if (article.doi) {
            try {
                console.log(`  🏴‍☠️ Tentative Sci-Hub pour le DOI: ${article.doi}...`);
                const buf = await SciHubService.fetchPdfBuffer(article.doi);
                if (buf && isPDF(buf)) {
                    console.log(`  🟢 PDF complet via Sci-Hub`);
                    return { buffer: buf, method: 'scihub' };
                }
            } catch (e) {
                console.log(`  ⚠️  Sci-Hub échoué (${e.message})`);
            }
        }

        // ── 3. Axios sur l'URL originale de l'article ───────────────────────
        if (article.oa_url) {
            try {
                const buf = await this.downloadWithAxios(article.oa_url);
                console.log(`  🟢 PDF complet via URL originale`);
                return { buffer: buf, method: 'original_axios' };
            } catch (e) {
                console.log(`  ⚠️  Axios original échoué (${e.message})`);
            }
        }

        // ── 4. Puppeteer sur la meilleure URL dispo ──────────────────────────
        const puppeteerUrl = oaUrls?.[0] || article.oa_url;
        if (puppeteerUrl) {
            try {
                console.log(`  🛡️ Déploiement Puppeteer pour ${puppeteerUrl.substring(0, 40)}...`);
                const buf = await this.downloadWithPuppeteer(puppeteerUrl);
                console.log(`  🟢 PDF complet via Puppeteer`);
                return { buffer: buf, method: 'puppeteer' };
            } catch (e) {
                console.log(`  ⚠️  Puppeteer échoué (${e.message})`);
            }
        }

        // ── 5. Fallback ultime : abstract uniquement ──────────────────────────
        console.log(`  🔴 Repli sur abstract uniquement`);
        return { buffer: null, method: 'abstract_only' };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ENTRÉE PUBLIQUE ET BOUCLE MASSIVE
    // ══════════════════════════════════════════════════════════════════════════
    static async startMassiveResearch(query, amount, projectId, depth = 0) {
        const uniqueArticles = await AggregatorService.searchAndMerge(query, amount);
        if (uniqueArticles.length > 0) {
            await this.processMassiveDownloads(uniqueArticles, projectId, depth); // On passe la profondeur
        } else {
            console.log("Aucun article trouvé.");
        }
    }

    static async processMassiveDownloads(articles, projectId) {
        console.log(`\n🚀 Démarrage — ${articles.length} articles à traiter (pipeline 5 niveaux)\n`);

        const storageDir = path.resolve(__dirname, '../data/articles');
        await fs.mkdir(storageDir, { recursive: true });

        const stats = { full: 0, abstract: 0, failed: 0 };

        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batch = articles.slice(i, i + BATCH_SIZE);
            const groupNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalGroups = Math.ceil(articles.length / BATCH_SIZE);
            console.log(`\n──────────── Groupe ${groupNum}/${totalGroups} ────────────`);

            await Promise.all(batch.map(async (article) => {
                const safeId = article.id.replace(/[^a-zA-Z0-9]/g, '_');
                const filePath = path.join(storageDir, `${safeId}.txt`);
                const shortTitle = article.title?.substring(0, 40) || 'Sans titre';
                console.log(`\n📄 "${shortTitle}..."`);

                try {
                    const { buffer, method } = await this.downloadArticle(article);
                    let textToSave = '';

                    if (buffer && isPDF(buffer)) {
                        // Texte intégral extrait du PDF
                        const parsed = await pdfParse(buffer);
                        textToSave = parsed.text.replace(/\n\s*\n/g, '\n').trim();
                        stats.full++;
                    } else {
                        // Abstract de secours
                        const abstract = article.abstract || "Aucun résumé disponible.";
                        textToSave = [
                            `--- ABSTRACT ONLY [${method.toUpperCase()}] ---`,
                            `TITLE: ${article.title}`,
                            `DATE: ${article.published_date}`,
                            `SOURCE: ${article.source}`,
                            `DOI: ${article.doi || 'N/A'}`,
                            `URL: ${article.oa_url}`,
                            ``,
                            `ABSTRACT:`,
                            abstract,
                        ].join('\n');
                        stats.abstract++;
                    }

                    if (textToSave.length > 50) {
                        // 1. On sauvegarde l'article brut
                        await fs.writeFile(filePath, textToSave, 'utf8');
                        db.run(
                            `INSERT OR IGNORE INTO articles (id, title, published_date, oa_url, local_file_path, project_id) VALUES (?, ?, ?, ?, ?, ?)`,
                            [safeId, article.title, article.published_date, article.oa_url, filePath, projectId]
                        );

                        // 2. AUTOMATISATION : On lance l'analyse IA immédiatement après le téléchargement !
                        try {
                            console.log(`  🧠 Lancement de l'analyse IA pour cet article...`);
                            const analysis = await AiReaderService.analyzeArticle(filePath);
                            db.run(
                                `INSERT OR REPLACE INTO article_analysis (article_id, metadata, notes, synthesis) VALUES (?, ?, ?, ?)`,
                                [safeId, analysis.meta, analysis.notes, analysis.synthesis]
                            );
                            console.log(`  ✅ Analyse IA terminée et sauvegardée.`);
                        } catch (aiErr) {
                            console.log(`  🔴 Échec de l'analyse IA automatique : ${aiErr.message}`);
                        }
                    }

                } catch (err) {
                    stats.failed++;
                    console.log(`  🔴 Échec critique : ${err.message}`);
                }
            }));

            if (i + BATCH_SIZE < articles.length) {
                const delay = jitter(2000, 2000);
                console.log(`\n😴 Pause ${delay}ms avant le prochain groupe...`);
                await sleep(delay);
            }
        }

        console.log(`\n${'═'.repeat(50)}`);
        console.log(`🏁 Téléchargements et analyses individuelles terminés !`);
        console.log(`   ✅ Textes intégraux : ${stats.full}`);
        console.log(`${'═'.repeat(50)}\n`);

        // 3. AUTOMATISATION : On génère le rapport final, en passant la profondeur actuelle !
        console.log(`👑 Lancement automatique de la synthèse globale du projet...`);
        this.generateAutoSynthesis(projectId, depth);
    }

    static generateAutoSynthesis(projectId, depth = 0) {
        const query = `
            SELECT a.title, aa.synthesis 
            FROM articles a JOIN article_analysis aa ON a.id = aa.article_id 
            WHERE a.project_id = ?
        `;

       db.all(query, [projectId], async (err, rows) => {
            if (err || !rows || rows.length === 0) return console.log("⚠️ Impossible de faire la synthèse.");
            
            // 1. On intègre le score de qualité (les étoiles) et le type d'étude dans le texte envoyé à l'IA
            let aggregatedData = rows.map((r, i) => {
                let scoreText = "⭐⭐⭐ (Non noté)";
                let studyType = "Inconnu";
                try {
                    const meta = JSON.parse(r.metadata); // On lit le JSON généré par l'Agent Lecteur
                    if (meta.quality_score) scoreText = '⭐'.repeat(meta.quality_score);
                    if (meta.study_type) studyType = meta.study_type;
                } catch(e) {}
                
                return `### ÉTUDE ${i + 1} : ${r.title} \n[Type: ${studyType} | Fiabilité: ${scoreText}]\n${r.synthesis}\n`;
            }).join('\n');

            if (aggregatedData.length > 60000) aggregatedData = aggregatedData.substring(0, 60000) + "\n[... Tronqué ...]";

            try {
                // 2. On durcit le Prompt du Directeur de Recherche
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
                console.log(`🎉 MÉGA-SYNTHÈSE TERMINÉE ! Le rapport du projet #${projectId} a été mis à jour.`);

                // ─── LA BOUCLE D'AUTO-INSPIRATION ───
                const MAX_DEPTH = 5; // 1 = l'IA a le droit de relancer UNE SEULE FOIS une recherche dérivée.

                if (depth < MAX_DEPTH) {
                    console.log(`\n💡 L'IA réfléchit aux zones d'ombre de sa propre synthèse...`);
                    const newQueries = await AiReaderService.generateInspirationQueries(finalReport);

                    if (newQueries.length > 0) {
                        console.log(`  🎯 Eurêka ! L'IA veut approfondir ces sujets :`, newQueries);

                        // L'IA lance ses propres recherches de manière asynchrone
                        for (const query of newQueries) {
                            console.log(`\n🚀 [Auto-Pilote] L'IA lance une recherche sur : "${query}"`);

                            // On demande à l'Aggregator 3 articles par nouvelle idée (pour ne pas saturer)
                            const newArticles = await AggregatorService.searchAndMerge(query, 3);
                            if (newArticles.length > 0) {
                                // On relance le pipeline avec depth + 1 pour ne pas boucler à l'infini
                                await this.processMassiveDownloads(newArticles, projectId, depth + 1);
                            }
                        }
                    } else {
                        console.log(`  🛑 L'IA estime que le sujet est suffisamment couvert.`);
                    }
                } else {
                    console.log(`  🛡️ Arrêt de l'Auto-Inspiration (Limite de profondeur atteinte).`);
                }

            } catch (err) {
                console.log(`🔴 Échec de la synthèse ou de l'auto-inspiration : ${err.message}`);
            }
        });
    }
}

module.exports = ResearchServiceMassive;