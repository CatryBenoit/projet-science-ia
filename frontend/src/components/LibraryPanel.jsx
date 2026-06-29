import { useState, useEffect } from 'react';
import api from '../api';

function LibraryPanel({ activeProjectId }) {
    const [articles, setArticles] = useState([]);
    const [selectedArticleContent, setSelectedArticleContent] = useState('');
    const [selectedArticleTitle, setSelectedArticleTitle] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loadingContent, setLoadingContent] = useState(false);

    const fetchArticles = async () => {
        if (!activeProjectId) {
            setArticles([]);
            return;
        }
        try {
            const res = await api.get('/library/articles');
            const projectArticles = res.data.filter(a => a.project_id === parseInt(activeProjectId));
            setArticles(projectArticles);
        } catch (err) {
            console.error("Erreur bibliothèque:", err);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, [activeProjectId]);

    // Fonction pour lire le Texte Brut
    const handleViewContent = async (id, title) => {
        setLoadingContent(true);
        setSelectedArticleTitle(title + " (Texte Original)");
        setShowModal(true);
        try {
            const res = await api.get(`/library/articles/${id}/content`);
            setSelectedArticleContent(res.data.content);
        } catch (err) {
            setSelectedArticleContent("❌ Impossible de charger le texte original.");
        } finally {
            setLoadingContent(false);
        }
    };

    // NOUVELLE FONCTION : Lire l'Analyse IA existante
    const handleViewAnalysis = async (id, title) => {
        setLoadingContent(true);
        setSelectedArticleTitle(title + " (Analyse IA)");
        setShowModal(true);
        try {
            const res = await api.get(`/library/articles/${id}/analysis`);
            const data = res.data;
            // On formate le rendu pour que ce soit beau à lire
            setSelectedArticleContent(`✅ MÉTADONNÉES :\n${data.metadata}\n\n🧠 SYNTHÈSE DE L'ÉTUDE :\n${data.synthesis}\n\n📝 NOTES DÉTAILLÉES :\n${data.notes}`);
        } catch (err) {
            setSelectedArticleContent("⏳ Cet article n'a pas encore été traité ou l'analyse est en cours d'écriture par l'IA...");
        } finally {
            setLoadingContent(false);
        }
    };

    if (!activeProjectId) return null;

    return (
        <div className="card library-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>📚 Bibliothèque Numérique ({articles.length} articles)</h3>
                <button onClick={fetchArticles} className="btn-small">🔄 Actualiser la liste</button>
            </div>

            <div className="table-container">
                {articles.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Aucun article stocké pour le moment.</p>
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
                                            <button onClick={() => handleViewContent(article.id, article.title)} className="btn-small">📖 Texte</button>
                                            {/* NOUVEAU BOUTON : Affiche l'analyse de l'IA */}
                                            <button onClick={() => handleViewAnalysis(article.id, article.title)} className="btn-small" style={{ background: '#9b59b6' }}>🧠 Voir Analyse</button>
                                            <a href={article.oa_url} target="_blank" rel="noreferrer" className="btn-link">PDF 🔗</a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <header className="modal-header">
                            <h4>{selectedArticleTitle}</h4>
                            <button onClick={() => { setShowModal(false); setSelectedArticleContent(''); }} className="btn-danger">❌ Fermer</button>
                        </header>
                        <div className="modal-body">
                            {loadingContent ? (
                                <div className="loading-txt">⏳ Chargement...</div>
                            ) : (
                                <pre className="raw-text-viewer" style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                                    {selectedArticleContent}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LibraryPanel;