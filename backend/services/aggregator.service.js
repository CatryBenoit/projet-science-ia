const OpenAlexProvider = require('./providers/openalex.provider');
const SemanticScholarProvider = require('./providers/semanticscholar.provider');
const HalProvider = require('./providers/hal.service');
const ArxivProvider = require('./providers/arxiv.service');
const PmcProvider = require('./providers/pmc.service');

class AggregatorService {
    
    static async searchAndMerge(query, amountPerProvider = 50) {
        console.log(`\n🔄 Démarrage de l'Aggregator pour : "${query}"`);

        // 1. Lancer toutes les recherches EN PARALLÈLE pour gagner du temps
        const results = await Promise.allSettled([
            OpenAlexProvider.search(query, amountPerProvider),
            SemanticScholarProvider.search(query, amountPerProvider),
            HalProvider.search(query, amountPerProvider),
            ArxivProvider.search(query, amountPerProvider),
            PmcProvider.search(query, amountPerProvider)
        ]);

        // 2. Récupérer tous les articles trouvés dans une seule grande liste brute
        let allArticlesBruts = [];
        results.forEach(promise => {
            if (promise.status === 'fulfilled') {
                allArticlesBruts = allArticlesBruts.concat(promise.value);
            }
        });

        console.log(`📊 Total brut trouvé : ${allArticlesBruts.length} articles.`);

        // 3. FUSION ET DÉDUPLICATION (Le cœur du système)
        const uniqueArticlesMap = new Map();

        allArticlesBruts.forEach(article => {
            // Clé de déduplication primaire : le DOI. 
            // Si pas de DOI, on utilise le titre en minuscules (sans espaces) pour repérer les doublons.
            const deduplicationKey = article.doi 
                ? `doi_${article.doi}` 
                : `title_${article.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            // Si l'article n'est pas encore dans notre Map, on l'ajoute
            if (!uniqueArticlesMap.has(deduplicationKey)) {
                uniqueArticlesMap.set(deduplicationKey, article);
            } else {
                // S'il y est déjà, on peut enrichir la source pour le log
                const existing = uniqueArticlesMap.get(deduplicationKey);
                existing.source += ` + ${article.source}`;
            }
        });

        // 4. On retransforme la Map en Array classique
        const finalUniqueArticles = Array.from(uniqueArticlesMap.values());
        
        console.log(`✨ Total après déduplication : ${finalUniqueArticles.length} articles uniques prêts au téléchargement.\n`);
        return finalUniqueArticles;
    }
}

module.exports = AggregatorService;