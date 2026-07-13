const ArxivService = require('./providers/arxiv.service');
const HalService = require('./providers/hal.service');
const PmcService = require('./providers/pmc.service');
const SemanticScholarProvider = require('./providers/semanticscholar.provider');
const OpenAlexProvider = require('./providers/openalex.provider');
const BioRxivService = require('./providers/biorxiv.service');
const ChemRxivService = require('./providers/chemrxiv.service');
const ClinicalTrialsService = require('./providers/clinicaltrials.service');
const PatentsService = require('./providers/patents.service');
const CoreService = require('./providers/core.service');
const RedditService = require('./providers/reddit.service');
const DataciteService = require('./providers/datacite.service');
const NewsApiService = require('./providers/newsapi.service');



const Logger = require('./logger.service');

class AggregatorService {
    static async searchAndMerge(query, limitPerSource = 3) {
        Logger.log(`\n🌐 [AGRÉGATEUR] Lancement d'une recherche mondiale sur 10 bases de données pour "${query}"...`);
        
        try {
            // On lance TOUTES les recherches en même temps (en parallèle)
            const results = await Promise.allSettled([
                ArxivService.search(query, limitPerSource),
                HalService.search(query, limitPerSource),
                PmcService.search(query, limitPerSource),
                SemanticScholarProvider.search(query, limitPerSource),
                OpenAlexProvider.search(query, limitPerSource),
                BioRxivService.search(query, limitPerSource),
                ChemRxivService.search(query, limitPerSource),
                ClinicalTrialsService.search(query, limitPerSource),
                PatentsService.search(query, limitPerSource),
                CoreService.search(query, limitPerSource),
                RedditService.search(query, limitPerSource),
                DataciteService.search(query, limitPerSource),
                NewsApiService.search(query, limitPerSource)
            ]);

            let allArticles = [];

            results.forEach((promiseResult, index) => {
                if (promiseResult.status === 'fulfilled') {
                    allArticles = allArticles.concat(promiseResult.value);
                } else {
                    Logger.log(`⚠️ Un des fournisseurs a échoué (Index ${index}): ${promiseResult.reason}`);
                }
            });

            // Déduplication (On enlève les doublons si plusieurs bases renvoient le même article)
            const uniqueArticles = [];
            const seenTitles = new Set();

            for (const article of allArticles) {
                if (!article || !article.title) continue;
                const normalizedTitle = article.title.toLowerCase().trim();
                
                if (!seenTitles.has(normalizedTitle)) {
                    seenTitles.add(normalizedTitle);
                    uniqueArticles.push(article);
                }
            }

            Logger.log(`✅ [AGRÉGATEUR] ${uniqueArticles.length} documents uniques fusionnés et prêts pour l'Aspirateur.`);
            return uniqueArticles;

        } catch (error) {
            Logger.log(`❌ Erreur globale de l'Agrégateur : ${error.message}`);
            return [];
        }
    }
}

module.exports = AggregatorService;