const axios = require('axios');

class PmcProvider {
    static async search(query, amount = 50) {
        try {
            console.log(`[PMC] Recherche de "${query}"...`);
            // OPEN_ACCESS:Y garantit qu'on a le droit de télécharger
            const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}%20AND%20OPEN_ACCESS:Y&format=json&resultType=core&pageSize=${amount}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            let results = response.data.resultList.result || [];

            return results
                .filter(work => work.fullTextUrlList && work.fullTextUrlList.fullTextUrl)
                .map(work => {
                    // Chercher l'URL du PDF parmi les liens disponibles
                    let urls = work.fullTextUrlList.fullTextUrl;
                    if (!Array.isArray(urls)) urls = [urls];
                    let pdfUrlObj = urls.find(u => u.documentStyle === 'pdf');

                    return {
                        id: `PMC_${work.pmcid || work.id}`,
                        doi: work.doi || null,
                        title: work.title,
                        published_date: work.firstPublicationDate || 'Inconnue',
                        oa_url: pdfUrlObj ? pdfUrlObj.url : null,
                        source: 'PubMedCentral'
                    };
                }).filter(a => a.oa_url);
        } catch (error) {
            console.error(`[PMC] Erreur : ${error.message}`);
            return [];
        }
    }
}

module.exports = PmcProvider;