import { useState, useEffect, useRef } from 'react';
import api from '../api';
import ConflictBadge from './ConflictBadge';

function LibraryPanel({ activeProjectId }) {
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [analysis, setAnalysis] = useState(null);

    // États pour gérer l'ajout de vidéo
    const [showVideoInput, setShowVideoInput] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');

    // États et Référence pour gérer l'upload de PDF
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

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

    const handleVideoSubmit = async (e) => {
        e.preventDefault();
        if (!videoUrl.trim() || !activeProjectId) return;

        setIsUploading(true);
        try {
            const res = await api.post(`/library/projects/${activeProjectId}/video`, { url: videoUrl });
            alert(`✅ ${res.data.message}`);
            setVideoUrl('');
            setShowVideoInput(false);
            fetchArticles();
        } catch (err) {
            alert(`❌ ${err.response?.data?.error || "Erreur lors de l'ajout de la vidéo."}`);
        } finally {
            setIsUploading(false);
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeProjectId) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(true);
        try {
            await api.post(`/library/projects/${activeProjectId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("✅ Document ajouté avec succès à la bibliothèque !");
            fetchArticles();
        } catch (err) {
            console.error("Erreur d'upload :", err);
            alert("❌ Erreur lors de l'envoi du document.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Tri des données par catégorie
    const academicArticles = articles.filter(a => a.type === 'academic' || !a.type);
    const datasets = articles.filter(a => a.type === 'dataset');
    const news = articles.filter(a => a.type === 'news');
    const testimonies = articles.filter(a => a.type === 'testimony');

    // Fonction de rendu dynamique pour les tableaux
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
                            <th>Éthique</th>
                            <th>Catégorie IA</th>
                            <th>Date</th>
                            <th>Source</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr><td colSpan="6">Aucun document dans cette catégorie.</td></tr>
                        ) : (
                            data.map(item => (
                                <tr key={item.id}>
                                    <td className="table-title" title={item.title}>{item.title}</td>
                                    <td><ConflictBadge conflictString={item.conflict_of_interest} /></td>
                                    <td>
                                        <span style={{ 
                                            padding: '4px 10px', 
                                            borderRadius: '12px', 
                                            fontSize: '0.75rem', 
                                            backgroundColor: 'var(--bg-hover)', 
                                            color: 'var(--primary)',
                                            fontWeight: '600',
                                            border: '1px solid var(--border)',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            🏷️ {item.macro_theme || 'En cours...'}
                                        </span>
                                    </td>
                                    <td>{item.published_date}</td>
                                    <td><a href={item.oa_url} target="_blank" rel="noreferrer" style={{color: 'var(--primary)'}}>{linkText}</a></td>
                                    <td>
                                        <button className="btn-small" style={{ backgroundColor: colorHex }} onClick={() => viewAnalysis(item.id)}>
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
        <div className="panel">
            {/* En-tête avec les boutons d'ajout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>📚 Base de Connaissances</h3>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={() => setShowVideoInput(!showVideoInput)}
                    >
                        🎥 Ajouter une Vidéo
                    </button>

                    <input 
                        type="file" 
                        accept=".pdf,.txt" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload} 
                    />
                    <button 
                        className="btn" 
                        onClick={() => fileInputRef.current.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? '⏳ Traitement...' : '📤 Ajouter un document'}
                    </button>
                </div>
            </div>

            {/* Champ de saisie pour la vidéo (Affiche conditionnellement) */}
            {showVideoInput && (
                <form onSubmit={handleVideoSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: 'var(--bg-hover)', padding: '15px', borderRadius: '8px' }}>
                    <input 
                        type="url" 
                        placeholder="Coller le lien YouTube ici (ex: https://youtu.be/...)" 
                        value={videoUrl} 
                        onChange={(e) => setVideoUrl(e.target.value)} 
                        style={{ margin: 0, flexGrow: 1 }}
                        required
                    />
                    <button type="submit" disabled={isUploading} style={{ backgroundColor: 'var(--danger)' }}>
                        Lancer l'Agent Transcripteur
                    </button>
                </form>
            )}

            {/* AFFICHAGE DES 4 TABLEAUX THÉMATIQUES */}
            {renderTable("Littérature Scientifique", "📄", "var(--primary)", academicArticles, "Lien Fichier")}
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
                            <h5 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Métadonnées extraites :</h5>
                            <pre style={{ background: 'var(--bg-base)', padding: '15px', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem', marginBottom: '20px' }}>
                                {analysis.metadata}
                            </pre>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Synthèse de l'article :</h5>
                            <div style={{ whiteSpace: 'pre-wrap', marginBottom: '20px' }}>{analysis.synthesis}</div>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Notes de lecture brutes :</h5>
                            <details>
                                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: '500' }}>Voir les notes détaillées</summary>
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