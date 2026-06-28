import { useState, useEffect } from 'react';
import api from '../api';

function LibraryPanel() {
    const [articles, setArticles] = useState([]);
    const [selectedArticleContent, setSelectedArticleContent] = useState('');
    const [selectedArticleTitle, setSelectedArticleTitle] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loadingContent, setLoadingContent] = useState(false);

    // Charger la liste des articles au démarrage
    const fetchArticles = async () => {
        try {
            const res = await api.get('/library/articles');
            setArticles(res.data);
        } catch (err) {
            console.error("Erreur bibliothèque:", err);
        }
    };
const handleAnalyzeArticle = async (id) => {
    setLoadingContent(true);
    try {
        const res = await api.post(`/library/articles/${id}/analyze`);
        alert("Analyse réussie !");
        console.log(res.data.analysis);
    } catch (err) {
        alert("Erreur lors de l'analyse IA");
    } finally {
        setLoadingContent(false);
    }
};


    useEffect(() => {
        fetchArticles();
    }, []);

    // Lire le texte d'un article
    const handleViewContent = async (id, title) => {
        setLoadingContent(true);
        setSelectedArticleTitle(title);
        setShowModal(true);
        try {
            const res = await api.get(`/library/articles/${id}/content`);
            setSelectedArticleContent(res.data.content);
        } catch (err) {
            setSelectedArticleContent("❌ Impossible de charger le texte de cet article.");
        } finally {
            setLoadingContent(false);
        }
    };

    return (
        <div className="card library-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>📚 Bibliothèque Numérique ({articles.length} articles)</h3>
                <button onClick={fetchArticles} style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}>🔄 Actualiser</button>
            </div>

            <div className="table-container">
                {articles.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Aucun article stocké pour le moment. Utilisez l'aspirateur ci-dessus !</p>
                ) : (
                    <table className="library-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Titre de l'étude</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {articles.map((article) => (
                                <tr key={article.id}>
                                    <td style={{ fontSize: '13px', color: '#888' }}>{article.published_date || 'N/A'}</td>
                                    <td className="table-title" title={article.title}>{article.title}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => handleViewContent(article.id, article.title)} className="btn-small">👁️ Lire le texte</button>
                                            <a href={article.oa_url} target="_blank" rel="noreferrer" className="btn-link">PDF 🔗</a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- MODALE LISEUSE DE TEXTE --- */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <header className="modal-header">
                            <h4>{selectedArticleTitle}</h4>
                            <button onClick={() => { setShowModal(false); setSelectedArticleContent(''); }} className="btn-close">❌ Fermer</button>
                            
                        </header>
                        <div className="modal-body">
                            {loadingContent ? (
                                <div className="loading-txt">⏳ Extraction et lecture du fichier texte...</div>
                            ) : (
                                <pre className="raw-text-viewer">{selectedArticleContent}</pre>
                            )}
                            <button onClick={() => handleAnalyzeArticle(article.id)} className="btn-small-ai">
    🧠 Analyser avec IA
</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LibraryPanel;