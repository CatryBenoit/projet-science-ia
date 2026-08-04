import { useState, useEffect } from 'react';
import api from '../api';

function DataVizPanel({ activeProjectId }) {
    const [stats, setStats] = useState({ macro: {}, micro: {}, totalArticles: 0 });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (activeProjectId) fetchStats();
    }, [activeProjectId]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/projects/${activeProjectId}/stats`);
            setStats(res.data);
        } catch (err) {
            console.error("Erreur de récupération des stats :", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculer le maximum pour les barres de progression
    const maxMacro = Math.max(...Object.values(stats.macro), 1);
    const maxMicro = Math.max(...Object.values(stats.micro), 1);

    if (isLoading) {
        return <div className="panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Chargement des données analytiques...</div>;
    }

    if (stats.totalArticles === 0) {
        return (
            <div className="panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                Aucune donnée à analyser. Veuillez importer et analyser des articles dans l'Espace de Travail.
            </div>
        );
    }

    return (
        <div className="panel" style={{ height: '100%', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>📊 Analyse des données IA ({stats.totalArticles} documents)</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* GRAPHIQUE DES MACRO-THÈMES (Barres horizontales) */}
                <div style={{ backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ marginTop: 0, color: 'var(--primary)' }}>Domaines de recherche (Macro-thèmes)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(stats.macro).map(([theme, count]) => (
                            <div key={theme}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 'bold' }}>{theme}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{count} doc(s)</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(count / maxMacro) * 100}%`, 
                                        backgroundColor: 'var(--primary)',
                                        borderRadius: '4px',
                                        transition: 'width 0.5s ease-in-out'
                                    }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* NUAGE DE MOTS-CLÉS (Micro-thèmes) */}
                <div style={{ backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ marginTop: 0, color: 'var(--accent)' }}>Nuage de mots-clés (Micro-thèmes)</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                        {Object.entries(stats.micro).map(([word, count]) => {
                            // Calcul de la taille de la police entre 0.8rem et 2rem selon la fréquence
                            const fontSize = 0.8 + ((count / maxMicro) * 1.2);
                            // Calcul de l'opacité
                            const opacity = 0.5 + ((count / maxMicro) * 0.5);
                            
                            return (
                                <span key={word} style={{ 
                                    fontSize: `${fontSize}rem`, 
                                    opacity: opacity,
                                    fontWeight: count === maxMicro ? 'bold' : 'normal',
                                    color: 'var(--text-main)',
                                    padding: '4px 8px',
                                    backgroundColor: 'var(--bg-hover)',
                                    borderRadius: '8px',
                                    transition: 'transform 0.2s',
                                    cursor: 'default'
                                }}
                                onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                title={`Apparaît ${count} fois`}
                                >
                                    {word}
                                </span>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default DataVizPanel;