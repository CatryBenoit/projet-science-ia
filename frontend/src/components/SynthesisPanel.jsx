import { useState, useEffect } from 'react';
import api from '../api';

function SynthesisPanel({ activeProjectId }) {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const fetchSynthesis = async () => {
        if (!activeProjectId) return;
        setIsLoading(true);
        setStatusMsg("Recherche du rapport...");
        try {
            const res = await api.get(`/projects/${activeProjectId}/synthesis`);
            setReport(res.data.report);
            if (!res.data.report) {
                setStatusMsg("⏳ Aucun rapport terminé pour le moment. Vérifiez le Terminal pour voir si l'IA travaille encore !");
            } else {
                setStatusMsg(''); // On efface le message si on a le rapport
            }
        } catch (err) {
            console.error("Erreur chargement synthèse :", err);
            setStatusMsg("❌ Erreur de récupération.");
        } finally {
            setIsLoading(false);
        }
    };

    // Charge le rapport quand on change de projet
    useEffect(() => {
        fetchSynthesis();
    }, [activeProjectId]);

    const handleGenerateSynthesis = async () => {
        if (!activeProjectId) return;
        setIsLoading(true);
        setStatusMsg("⏳ L'IA lit les analyses et rédige le rapport final...");
        try {
            const res = await api.post(`/projects/${activeProjectId}/synthesis`);
            setReport(res.data.report);
            setStatusMsg(`✅ Rapport généré avec succès !`);
        } catch (err) {
            setStatusMsg(`❌ Erreur : ${err.response?.data?.error || "L'IA n'a pas pu terminer."}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeProjectId) return null;

    return (
        <div className="card" style={{ borderColor: '#9b59b6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#9b59b6' }}>📝 Rapport de Synthèse Transversale</h3>
                <div>
                    {/* NOUVEAU BOUTON : Rafraîchir l'affichage */}
                    <button onClick={fetchSynthesis} className="btn-small" style={{ marginRight: '10px' }}>
                        🔄 Rafraîchir l'affichage
                    </button>
                    <button onClick={handleGenerateSynthesis} className="btn-small" style={{ backgroundColor: '#9b59b6' }} disabled={isLoading}>
                        {isLoading ? "🧠 Rédaction..." : "✨ Forcer la génération"}
                    </button>
                </div>
            </div>

            {statusMsg && <p style={{ fontSize: '13px', marginBottom: '15px', color: '#bdc3c7' }}>{statusMsg}</p>}

            <div className="synthesis-content" style={{ 
                background: '#0f3460', padding: '20px', borderRadius: '8px', minHeight: '100px', maxHeight: '500px', overflowY: 'auto' 
            }}>
                {report ? (
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif', lineHeight: '1.6', color: '#ecf0f1', fontSize: '14px' }}>
                        {report}
                    </pre>
                ) : (
                    <p style={{ color: '#7f8c8d', textAlign: 'center', fontStyle: 'italic', marginTop: '30px' }}>
                        En attente du rapport de l'IA...
                    </p>
                )}
            </div>
        </div>
    );
}


export default SynthesisPanel;