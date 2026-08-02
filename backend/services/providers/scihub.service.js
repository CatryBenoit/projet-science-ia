const axios = require('axios');
const cheerio = require('cheerio');

class SciHubService {
    // Nom officiel pour le Logger
    static name = "Sci-Hub";

    // Les miroirs de Sci-Hub changent souvent, on en met plusieurs
    static MIRRORS = [
        'https://sci-hub.se',
        'https://sci-hub.st',
        'https://sci-hub.ru'
    ];

    /**
     * 🛡️ LA MÉTHODE MANQUANTE
     * Sci-Hub ne fait pas de recherche par mots-clés, il débloque via un DOI.
     * On retourne donc un tableau vide pour respecter l'interface des Providers.
     */
    static async search(query) {
        return []; 
    }

    /**
     * Récupère le PDF binaire à partir d'un DOI
     */
    static async fetchPdfBuffer(doi) {
        if (!doi) throw new Error("Aucun DOI fourni pour Sci-Hub.");

        let pdfLink = null;
        let activeMirror = null;

        // Faux navigateur pour passer les protections Cloudflare / Anti-bots
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        };

        // 1. On cherche un miroir qui fonctionne et on récupère la page HTML
        for (const mirror of this.MIRRORS) {
            try {
                const url = `${mirror}/${doi}`;
                const response = await axios.get(url, { timeout: 10000, headers });
                
                // 2. On utilise Cheerio pour analyser le HTML de Sci-Hub
                const $ = cheerio.load(response.data);
                
                // Sci-Hub met le lien du PDF dans une balise <embed id="pdf"> ou un <iframe>
                let src = $('#pdf').attr('src');
                
                if (src) {
                    // Parfois Sci-Hub renvoie un lien du type "//domain.com/pdf", il faut rajouter "https:"
                    if (src.startsWith('//')) src = 'https:' + src;
                    if (src.startsWith('/')) src = mirror + src;
                    
                    pdfLink = src;
                    activeMirror = mirror;
                    break; // On a trouvé, on sort de la boucle !
                }
            } catch (err) {
                // Ce miroir est bloqué ou mort, on teste le suivant
                continue; 
            }
        }

        if (!pdfLink) {
            throw new Error("Sci-Hub n'a pas trouvé cet article ou miroirs inaccessibles.");
        }

        // 3. On télécharge le fichier PDF binaire depuis le lien trouvé
        console.log(`🏴‍☠️ Sci-Hub a trouvé le PDF ! Téléchargement depuis : ${activeMirror}...`);
        const pdfResponse = await axios.get(pdfLink, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                ...headers,
                'Accept': 'application/pdf'
            }
        });

        return Buffer.from(pdfResponse.data);
    }
}

module.exports = SciHubService;