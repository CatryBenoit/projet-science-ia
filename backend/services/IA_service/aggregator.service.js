// Permet de recuper dans different basse des donnée comme des article ect 

const fs = require('fs');
const path = require('path');
const Logger = require('../app_Service/logger.service');

// Chargement automatique de tous les providers
const providers = fs
    .readdirSync(path.join(__dirname, '../providers'))
    .filter(file => file.endsWith('.js'))
    .map(file => {
        const provider = require(path.join(__dirname, '../providers', file));

        provider.providerName = provider.providerName || file.replace('.js', '');

        return provider;
    });

class AggregatorService {

    /**
     * Timeout d'une promesse
     */
    static withTimeout(promise, ms = 10000) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), ms)
            )
        ]);
    }

    /**
     * Recherche sur toutes les bases
     */
    static async searchAndMerge(query, limitPerSource = 3) {

        Logger.log(`\n🌐 [AGRÉGATEUR] Recherche sur ${providers.length} fournisseurs pour "${query}"...`);

        try {

            const results = await Promise.allSettled(
                providers.map(provider =>
                    this.withTimeout(
                        provider.search(query, limitPerSource),
                        10000
                    )
                )
            );

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    Logger.log(
                        `⚠️ ${providers[index].providerName} : ${result.reason.message}`
                    );
                }
            });

            const allArticles = results
                .filter(r => r.status === 'fulfilled')
                .flatMap(r => r.value);

            const uniqueArticles = [
                ...new Map(
                    allArticles
                        .filter(article => article?.title)
                        .map(article => [
                            article.title.trim().toLowerCase(),
                            article
                        ])
                ).values()
            ];

            Logger.log(
                `✅ [AGRÉGATEUR] ${uniqueArticles.length} documents uniques récupérés.`
            );

            return uniqueArticles;

        } catch (error) {

            Logger.log(`❌ Erreur de l'agrégateur : ${error.message}`
            );

            return [];
        }
    }
}

module.exports = AggregatorService;