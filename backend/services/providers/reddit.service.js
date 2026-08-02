const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class RedditService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[Reddit] Recherche de témoignages et vécus pour "${query}"...`);
            
            // On utilise l'API publique de Reddit. On trie par "relevance" (pertinence).
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`;
            
            const response = await axios.get(url, { 
                // Reddit exige un User-Agent personnalisé sinon il bloque la requête
                headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    },
                timeout: 15000 
            });
            
            const posts = response.data?.data?.children || [];
            
            return posts.map(post => {
                const data = post.data;
                return {
                    id: `reddit_${data.id}`,
                    title: `[FORUM] ${data.title}`,
                    abstract: data.selftext || "Lien ou image (voir la source pour les commentaires).",
                    published_date: new Date(data.created_utc * 1000).toISOString().split('T')[0],
                    source: `Reddit (Communauté r/${data.subreddit})`,
                    oa_url: `https://www.reddit.com${data.permalink}`,
                    doi: null,
                    type: 'testimony'
                };
            }).filter(post => post.abstract.length > 50); // On ne garde que les posts qui ont du vrai texte écrit
            
        } catch (error) {
            Logger.log(`⚠️ [Reddit] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = RedditService;