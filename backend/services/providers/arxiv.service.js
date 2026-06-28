const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

class ArxivProvider {
    static async search(query, amount = 50) {
        try {
            console.log(`[ArXiv] Recherche de "${query}"...`);
            const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${amount}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            // Conversion du XML en JSON
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            const jsonObj = parser.parse(response.data);
            
            let entries = jsonObj.feed.entry;
            if (!entries) return [];
            if (!Array.isArray(entries)) entries = [entries]; // Si un seul résultat

            return entries.map(entry => {
                // Trouver le lien qui se termine par /pdf ou dont l'attribut title est "pdf"
                let links = Array.isArray(entry.link) ? entry.link : [entry.link];
                let pdfLinkObj = links.find(l => l['@_title'] === 'pdf' || (l['@_href'] && l['@_href'].includes('pdf')));
                
                let pdfUrl = pdfLinkObj ? pdfLinkObj['@_href'] : null;
                // ArXiv a souvent des URLs sans le .pdf à la fin, on l'ajoute pour notre système
                if (pdfUrl && !pdfUrl.endsWith('.pdf')) pdfUrl += '.pdf';

                return {
                    id: entry.id.replace('http://arxiv.org/abs/', 'ARXIV_'),
                    doi: null, // Arxiv n'a pas toujours de DOI
                    title: entry.title.replace(/\n/g, ' ').trim(),
                    published_date: entry.published,
                    oa_url: pdfUrl,
                    source: 'ArXiv'
                };
            }).filter(a => a.oa_url); // Seulement si on a trouvé le PDF
        } catch (error) {
            console.error(`[ArXiv] Erreur : ${error.message}`);
            return [];
        }
    }
}

module.exports = ArxivProvider;