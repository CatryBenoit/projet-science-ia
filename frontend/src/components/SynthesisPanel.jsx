import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../api';

function SynthesisPanel({ activeProjectId }) {
    const [synthesis, setSynthesis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // 🆕 Nouvel état pour stocker la directive de l'utilisateur
    const [guidance, setGuidance] = useState('');

    useEffect(() => {
        fetchSynthesis();
    }, [activeProjectId]);

    const fetchSynthesis = async () => {
        if (!activeProjectId) return;
        try {
            const res = await api.get(`/projects/${activeProjectId}/synthesis`);
            setSynthesis(res.data.report || '');
        } catch (err) {
            setSynthesis('');
        }
    };

    const generateSynthesis = async () => {
        if (!activeProjectId) return;
        setIsLoading(true);
        try {
            // 🆕 On envoie le "guidance" dans le corps de la requête (req.body)
            const res = await api.post(`/projects/${activeProjectId}/synthesis`, { guidance });
            setSynthesis(res.data.report);
            
            // Optionnel : on peut vider le champ après génération, ou le laisser pour que l'utilisateur affine.
            // setGuidance(''); 
        } catch (err) {
            alert("Erreur lors de la génération de la synthèse.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeProjectId) return null;

    return (
        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>📝 Synthèse Globale</h3>
            </div>

            {/* 🎯 NOUVEAU : Zone de guidage en direct */}
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🎯 Guidage en direct (Optionnel)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="text" 
                        placeholder="Ex: Concentre-toi sur les effets secondaires, résume sous forme de tirets..." 
                        value={guidance}
                        onChange={(e) => setGuidance(e.target.value)}
                        style={{ margin: 0, flexGrow: 1 }}
                        disabled={isLoading}
                    />
                    <button 
                        onClick={generateSynthesis} 
                        disabled={isLoading} 
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {isLoading ? '⏳ Rédaction en cours...' : '✨ Générer la Synthèse'}
                    </button>
                </div>
            </div>

            {/* Zone d'affichage du Markdown */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {isLoading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ fontSize: '2rem' }}>🤖</span>
                        <p>L'Agent Rédacteur compile les données selon vos directives...</p>
                    </div>
                ) : synthesis ? (
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--text-main)' }}>
                        <ReactMarkdown>{synthesis}</ReactMarkdown>
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <p>Aucune synthèse disponible. Lancez la génération !</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SynthesisPanel;