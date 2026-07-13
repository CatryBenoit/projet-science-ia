const axios = require('axios');
const Logger = require('../logger.service');

class PatentsService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[Patents] Recherche de brevets industriels pour "${query}"...`);
            const q = `{"_text_any":{"patent_title":"${query}"}}`;
            const f = `["patent_num","patent_title","patent_abstract","patent_date"]`;
            const url = `https://api.patentsview.org/patents/query?q=${encodeURIComponent(q)}&f=${encodeURIComponent(f)}&o={"per_page":${limit}}`;
            
            const response = await axios.get(url, { timeout: 15000 });
            const patents = response.data?.patents || [];
            
            return patents.map(patent => ({
                id: `patent_${patent.patent_num}`,
                title: patent.patent_title || 'Brevet inconnu',
                abstract: patent.patent_abstract || "Aucun résumé technique disponible.",
                published_date: patent.patent_date || 'Date inconnue',
                source: 'Google Patents / USPTO',
                oa_url: `https://patents.google.com/patent/US${patent.patent_num}`,
                doi: null
            }));
        } catch (error) {
            Logger.log(`⚠️ [Patents] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = PatentsService;