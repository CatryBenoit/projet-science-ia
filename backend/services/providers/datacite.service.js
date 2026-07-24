const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class DataciteService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[DataCite] Recherche de jeux de données (Zenodo, Dryad...) pour "${query}"...`);
            // On filtre strictement sur "Dataset" pour n'avoir que des données brutes
            const url = `https://api.datacite.org/dois?query=${encodeURIComponent(query)}&resource-type-id=Dataset&page[size]=${limit}`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const datasets = response.data?.data || [];
            return datasets.map(item => {
                const attrs = item.attributes;
                return {
                    id: `dataset_${item.id}`,
                    title: `[DATASET] ${attrs.titles?.[0]?.title || 'Sans titre'}`,
                    abstract: attrs.descriptions?.[0]?.description || "Aucune description détaillée du jeu de données.",
                    published_date: attrs.publicationYear?.toString() || 'Date inconnue',
                    source: attrs.publisher || 'DataCite Aggregator',
                    oa_url: `https://doi.org/${item.id}`,
                    doi: item.id,
                    type: 'dataset' // 🛑 Étiquette "Donnée Brute"
                };
            });
        } catch (error) {
            Logger.log(`⚠️ [DataCite] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = DataciteService;