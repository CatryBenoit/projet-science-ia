const axios = require('axios');
const Logger = require('../logger.service');

class BioRxivService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[BioRxiv/MedRxiv] Recherche de preprints médicaux pour "${query}"...`);
            // Requête ciblée sur les preprints (PPR)
            const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)} (SRC:PPR)&format=json&resultType=core`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const results = response.data?.resultList?.result || [];
            return results.slice(0, limit).map(item => ({
                id: `biorxiv_${item.id}`,
                title: item.title || 'Titre inconnu',
                abstract: item.abstractText || "Aucun résumé disponible.",
                published_date: item.firstPublicationDate || item.pubYear || 'Date inconnue',
                source: item.bookOrReportDetails?.publisher || 'BioRxiv / MedRxiv',
                oa_url: item.fullTextUrlList?.fullTextUrl?.[0]?.url || `https://doi.org/${item.doi}`,
                doi: item.doi || null
            }));
        } catch (error) {
            Logger.log(`⚠️ [BioRxiv/MedRxiv] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = BioRxivService;