const axios = require('axios');

class HalProvider {
    static async search(query, amount = 50) {
        try {
            console.log(`[HAL] Recherche de "${query}"...`);
            // wt=json (format), fl=... (champs voulus)
            const url = `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(query)}&wt=json&fl=docid,title_s,producedDateY_i,doiId_s,fileMain_s&rows=${amount}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            return response.data.response.docs
                .filter(doc => doc.fileMain_s) // On ne garde que ceux avec un PDF principal
                .map(doc => ({
                    id: `HAL_${doc.docid}`,
                    doi: doc.doiId_s || null,
                    title: doc.title_s ? doc.title_s[0] : 'Titre inconnu',
                    published_date: doc.producedDateY_i ? `${doc.producedDateY_i}-01-01` : 'Inconnue',
                    oa_url: doc.fileMain_s, // Lien direct du PDF
                    source: 'HAL'
                }));
        } catch (error) {
            console.error(`[HAL] Erreur : ${error.message}`);
            return [];
        }
    }
}

module.exports = HalProvider;