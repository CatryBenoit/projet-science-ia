const axios = require('axios');

class SemanticScholarProvider {
    static async search(query, amount = 50) {
        try {
            console.log(`[SemanticScholar] Recherche de "${query}"...`);
            const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${amount}&fields=title,year,openAccessPdf,externalIds`;
            const response = await axios.get(url, { timeout: 10000 });
            
            return response.data.data
                .filter(p => p.openAccessPdf && p.openAccessPdf.url) // Que du gratuit
                .map(work => ({
                    id: work.paperId,
                    doi: work.externalIds?.DOI || null,
                    title: work.title,
                    published_date: work.year ? `${work.year}-01-01` : 'Inconnue',
                    oa_url: work.openAccessPdf.url,
                    source: 'SemanticScholar'
                })).filter(a => a.oa_url.endsWith('.pdf'));
        } catch (error) {
            console.error(`[SemanticScholar] Erreur : ${error.message}`);
            return [];
        }
    }
}

module.exports = SemanticScholarProvider;