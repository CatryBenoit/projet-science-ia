import { useState, useEffect } from 'react';
import api from '../api';

function SynthesisPanel({ activeProjectId }) {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    // Charge le rapport existant quand on change de projet
    useEffect(() => {
        if (!activeProjectId) return;
        
        const fetchSynthesis = async () => {
            try {
                const res = await api.get(`/projects/${activeProjectId}/synthesis`);
                setReport(res.data.report);
                setStatusMsg('');
            } catch (err) {
                console.error("Erreur chargement synthèse :", err);
            }
        };
        fetchSynthesis();
    }, [activeProjectId]);

    const handleGenerateSynthesis = async () => {
        if (!activeProjectId) return;
        
        setIsLoading(true);
        setStatusMsg("⏳ L'IA lit les analyses et rédige le rapport final (cela peut prendre 1 à 2 minutes)...");
        
        try {
            const res = await api.post(`/projects/${activeProjectId}/synthesis`);
            setReport(res.data.report);
            setStatusMsg(`✅ ${res.data.message} (Basé sur ${res.data.article_count} articles)`);
        } catch (err) {
            setStatusMsg(`❌ Erreur : ${err.response?.data?.error || "L'IA n'a pas pu terminer."}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeProjectId) return null; // On cache le panneau si aucun projet n'est sélectionné

    return (
        <div className="card" style={{ borderColor: '#9b59b6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#9b59b6' }}>📝 Rapport de Synthèse Transversale</h3>
                <button 
                    onClick={handleGenerateSynthesis} 
                    className="btn-small" 
                    style={{ backgroundColor: '#9b59b6' }}
                    disabled={isLoading}
                >
                    {isLoading ? "🧠 Rédaction en cours..." : "✨ Générer le Rapport Final"}
                </button>
            </div>

            {statusMsg && <p style={{ fontSize: '13px', marginBottom: '15px', color: '#bdc3c7' }}>{statusMsg}</p>}

            <div className="synthesis-content" style={{ 
                background: '#0f3460', 
                padding: '20px', 
                borderRadius: '8px', 
                minHeight: '100px',
                maxHeight: '500px',
                overflowY: 'auto'
            }}>
                {report ? (
                    <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        fontFamily: 'system-ui, sans-serif', 
                        lineHeight: '1.6', 
                        color: '#ecf0f1',
                        fontSize: '14px'
                    }}>
                        {report}
                    </pre>
                ) : (
                    <p style={{ color: '#7f8c8d', textAlign: 'center', fontStyle: 'italic', marginTop: '30px' }}>
                        Aucun rapport généré pour ce projet. Assurez-vous d'avoir analysé quelques articles, puis cliquez sur le bouton "Générer".
                    </p>
                )}
            </div>
        </div>
    );
}

export default SynthesisPanel;