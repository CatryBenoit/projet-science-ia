const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class ChemRxivService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[ChemRxiv] Recherche de preprints en chimie pour "${query}"...`);
            const url = `https://chemrxiv.org/engage/chemrxiv/public-api/v1/items?search=${encodeURIComponent(query)}&limit=${limit}`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const results = response.data?.itemHits || [];
            return results.map(hit => {
                const item = hit.item;
                return {
                    id: `chemrxiv_${item.id}`,
                    title: item.title || 'Titre inconnu',
                    abstract: item.abstract || "Aucun résumé disponible.",
                    published_date: item.publishedDate || 'Date inconnue',
                    source: 'ChemRxiv',
                    oa_url: `https://doi.org/${item.doi}`,
                    doi: item.doi || null
                };
            });
        } catch (error) {
            Logger.log(`⚠️ [ChemRxiv] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = ChemRxivService;