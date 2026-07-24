const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class NewsApiService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[NewsAPI] Recherche d'actualités et vulgarisation pour "${query}"...`);
            
            const apiKey = process.env.NEWS_API_KEY;
            if (!apiKey) {
                Logger.log(`⚠️ [NewsAPI] Ignoré : Clé API manquante. Ajoute NEWS_API_KEY dans ton fichier .env`);
                return [];
            }

            const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=relevance&pageSize=${limit}&apiKey=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const articles = response.data?.articles || [];
            return articles.map((article, index) => ({
                id: `news_${Date.now()}_${index}`,
                title: `[ACTUALITÉ] ${article.title}`,
                abstract: article.description || article.content || "Aucun résumé disponible.",
                published_date: article.publishedAt ? article.publishedAt.split('T')[0] : 'Date inconnue',
                source: article.source?.name || 'Média d\'actualité',
                oa_url: article.url,
                doi: null,
                type: 'news' // 🛑 Étiquette "Actualité"
            }));
        } catch (error) {
            Logger.log(`⚠️ [NewsAPI] Erreur : ${error.response?.data?.message || error.message}`);
            return [];
        }
    }
}
module.exports = NewsApiService;