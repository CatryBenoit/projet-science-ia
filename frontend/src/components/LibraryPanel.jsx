import { useState, useEffect } from 'react';
import api from '../api';
import ConflictBadge from './ConflictBadge';

function LibraryPanel({ activeProjectId }) {
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [analysis, setAnalysis] = useState(null);

    useEffect(() => {
        fetchArticles();
    }, [activeProjectId]);

    const fetchArticles = async () => {
        if (!activeProjectId) {
            setArticles([]);
            return;
        }
        try {
            const res = await api.get(`/library/projects/${activeProjectId}/articles`);
            setArticles(res.data);
        } catch (err) {
            console.error("Erreur bibliothèque:", err);
        }
    };

    const viewAnalysis = async (articleId) => {
        try {
            const res = await api.get(`/library/articles/${articleId}/analysis`);
            setAnalysis(res.data);
            setSelectedArticle(articleId);
        } catch (err) {
            alert("Analyse non disponible pour le moment.");
        }
    };

    // 🛑 TRI DES DONNÉES PAR CATÉGORIE
    const academicArticles = articles.filter(a => a.type === 'academic' || !a.type);
    const datasets = articles.filter(a => a.type === 'dataset');
    const news = articles.filter(a => a.type === 'news');
    const testimonies = articles.filter(a => a.type === 'testimony');

    // 🛠️ FONCTION DE RENDU DYNAMIQUE POUR LES TABLEAUX
    const renderTable = (title, emoji, colorHex, data, linkText) => (
        <>
            <h4 style={{ color: colorHex, marginTop: '25px', marginBottom: '10px' }}>
                {emoji} {title} ({data.length})
            </h4>
            <div className="table-container" style={{ marginBottom: '20px' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Titre</th>
                            <th>Catégorie IA</th>
                            <th>Date</th>
                            <th>Source</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr><td colSpan="5">Aucun document dans cette catégorie.</td></tr>
                        ) : (
                            data.map(item => (
                                <tr key={item.id}>
                                    <td className="table-title" title={item.title}>{item.title}</td>
                                    <ConflictBadge conflictString={item.conflict_of_interest} />
                                    {/* 🛑 NOUVELLE COLONNE : Badge du Thème IA */}
                                    <td>
                                        <span style={{ 
                                            padding: '3px 8px', 
                                            borderRadius: '12px', 
                                            fontSize: '0.75rem', 
                                            backgroundColor: 'var(--bg-hover)', 
                                            color: 'var(--primary)',
                                            fontWeight: 'bold',
                                            border: '1px solid var(--border)',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            🏷️ {item.macro_theme || 'En cours...'}
                                        </span>
                                    </td>

                                    <td>{item.published_date}</td>
                                    <td><a href={item.oa_url} target="_blank" rel="noreferrer">{linkText}</a></td>
                                    <td>
                                        <button className="btn-small" style={{ backgroundColor: colorHex, border: 'none' }} onClick={() => viewAnalysis(item.id)}>
                                            🔍 Analyse IA
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );

    return (
        <div className="card">
            <h3>📚 Base de Connaissances (Projet #{activeProjectId})</h3>

            {/* AFFICHAGE DES 4 TABLEAUX THÉMATIQUES */}
            {renderTable("Littérature Scientifique", "📄", "var(--primary)", academicArticles, "Lien PDF")}
            {renderTable("Jeux de Données Brutes", "📊", "#f59e0b", datasets, "Télécharger Data")}
            {renderTable("Actualités & Vulgarisation", "📰", "#0ea5e9", news, "Lire l'article")}
            {renderTable("Témoignages & Vie Réelle", "🗣️", "var(--success)", testimonies, "Voir le post")}

            {/* MODALE D'AFFICHAGE DE L'IA */}
            {selectedArticle && analysis && (
                <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h4>Rapport d'Analyse IA</h4>
                            <button className="btn-secondary btn-small" onClick={() => setSelectedArticle(null)}>Fermer</button>
                        </div>
                        <div className="modal-body">
                            <h5>Métadonnées extraites :</h5>
                            <pre style={{ background: 'var(--bg-base)', padding: '15px', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem' }}>
                                {analysis.metadata}
                            </pre>
                            <h5>Synthèse de l'article :</h5>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{analysis.synthesis}</div>
                            <h5>Notes de lecture brutes :</h5>
                            <details>
                                <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>Voir les notes détaillées</summary>
                                <div style={{ whiteSpace: 'pre-wrap', marginTop: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {analysis.notes}
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LibraryPanel;