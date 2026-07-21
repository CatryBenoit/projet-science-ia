import { useState } from 'react';
import api from '../api';

// On ajoute activeProjectId dans les props
function ResearchPanel({ activeProjectId }) {
    const [topic, setTopic] = useState('');
    const [amount, setAmount] = useState(100);
    const [statusMsg, setStatusMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const startAutonomousLoop = async () => {
        if (!activeProjectId) return;
        const confirmLoop = window.confirm(
            "🤖 Voulez-vous lancer l'Agent Deep Research ?\n\nL'IA va lire votre projet, identifier les manques et relancer des recherches en boucle en respectant vos branches élaguées.\n\nSuivez le processus en direct dans le Terminal !"
        );
        if (!confirmLoop) return;

        try {
            const res = await api.post('/research/autonomous-loop', { projectId: activeProjectId });
            alert(res.data.message);
        } catch (err) {
            alert("Erreur lors du lancement de l'Agent Autonome.");
        }
    };

    const handleStartResearch = async (e) => {
        e.preventDefault();
        
        // SÉCURITÉ : On bloque si pas de projet
        if (!activeProjectId) {
            setStatusMsg("❌ Impossible : Veuillez sélectionner ou créer un projet d'abord.");
            return;
        }
        if (!topic) return;

        setIsLoading(true);
        setStatusMsg("⏳ Connexion au serveur...");

        try {
            // ON AJOUTE projectId DANS LE CORPS DE LA REQUÊTE
            const res = await api.post('/research/start', { 
                topic: topic, 
                amount: parseInt(amount),
                projectId: activeProjectId
            });
            
            setStatusMsg(`✅ ${res.data.message}`);
            setTopic('');
        } catch (err) {
            setStatusMsg(`❌ ${err.response?.data?.error || "Erreur serveur"}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card research-card">
            <h3>🔬 Aspirateur Scientifique (OpenAlex)</h3>
            <p style={{ fontSize: '14px', marginBottom: '15px', color: '#a0aeba' }}>
                Lance une recherche massive. Le serveur téléchargera les PDF et extraira le texte en arrière-plan.
            </p>
            
            <form onSubmit={handleStartResearch} className="research-form">
                <input 
                    type="text" 
                    placeholder="Sujet (ex: Alzheimer immunotherapy, CRISPR...)" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    required 
                />
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                    <label style={{ whiteSpace: 'nowrap' }}>Nombre max :</label>
                    <input 
                        type="number" 
                        min="10" 
                        max="5000" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        style={{ marginBottom: '0' }}
                    />
                </div>
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>🤖 Mode Agent Autonome (Deep Research) :</span>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Laisse l'IA combler les lacunes du projet en relançant des recherches en boucle.</p>
    </div>
    <button 
        type="button" 
        onClick={startAutonomousLoop}
        style={{ 
            backgroundColor: '#4f46e5', 
            color: '#fff', 
            border: '1px solid #6366f1', 
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            boxShadow: '0 0 10px rgba(79, 70, 229, 0.4)'
        }}
    >
        🚀 Lancer l'exploration autonome
    </button>
</div>

                <button type="submit" disabled={isLoading} className="btn-research">
                    {isLoading ? "Envoi de la commande..." : "🚀 Lancer l'aspiration des données"}
                </button>
            </form>

            {statusMsg && (
                <div className="status-msg-box">
                    {statusMsg}
                </div>
            )}
        </div>
    );
}

export default ResearchPanel;