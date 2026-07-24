const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class CoreService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[CORE] Recherche dans le réseau mondial Open Access pour "${query}"...`);
            // Si tu crées une clé API un jour sur core.ac.uk, tu l'ajouteras dans le .env
            const apiKey = process.env.CORE_API_KEY || ''; 
            const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}`;
            
            const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
            const response = await axios.get(url, { headers, timeout: 15000 });
            
            const results = response.data?.results || [];
            return results.map(work => ({
                id: `core_${work.id}`,
                title: work.title || 'Titre inconnu',
                abstract: work.abstract || "Aucun résumé disponible.",
                published_date: work.publishedDate || work.yearPublished || 'Date inconnue',
                source: work.publisher || 'CORE Aggregator',
                oa_url: work.downloadUrl || work.links?.[0] || null,
                doi: work.doi || null
            }));
        } catch (error) {
            // L'API CORE limite beaucoup sans clé API, on l'ignore silencieusement si erreur 429
            if (error.response?.status !== 429) {
                Logger.log(`⚠️ [CORE] Erreur : ${error.message}`);
            }
            return [];
        }
    }
}
module.exports = CoreService;