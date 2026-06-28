const axios = require('axios');

class OpenAlexProvider {
    static async search(query, amount = 50) {
        try {
            console.log(`[OpenAlex] Recherche de "${query}"...`);
            const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=has_oa_accepted_or_published_version:true&per-page=${amount}&select=id,doi,title,publication_date,open_access,abstract_inverted_index`;            const response = await axios.get(url, { timeout: 10000 });
            
            return response.data.results.map(work => ({
                id: work.id.replace('https://openalex.org/', ''),
                doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
                title: work.title,
                published_date: work.publication_date,
                oa_url: work.open_access?.oa_url,
                source: 'OpenAlex'
            })).filter(a => a.oa_url && a.oa_url.endsWith('.pdf'));
        } catch (error) {
            console.error(`[OpenAlex] Erreur : ${error.message}`);
            return [];
        }
    }
}

module.exports = OpenAlexProvider;