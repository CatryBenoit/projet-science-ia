import { useState, useEffect } from 'react';
import api from '../api';

function ResearchPanel({ activeProjectId }) {
    // --- ÉTATS EXISTANTS ---
    const [topic, setTopic] = useState('');
    const [amount, setAmount] = useState(100);
    const [statusMsg, setStatusMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- NOUVEAUX ÉTATS (COPILOTE) ---
    const [copilotMode, setCopilotMode] = useState(false);
    const [projectStatus, setProjectStatus] = useState('IN_PROGRESS');
    const [suggestedQueries, setSuggestedQueries] = useState([]);
    const [approvedQueries, setApprovedQueries] = useState([]);
    const [customQuery, setCustomQuery] = useState('');
    const [currentDepth, setCurrentDepth] = useState(1);

    // --- EFFET DE BORD : CHARGEMENT & POLLING ---
    useEffect(() => {
        if (!activeProjectId) return;

        // On charge les données immédiatement
        fetchProjectData();

        // 🔄 POLLING : On vérifie l'état du projet toutes les 5 secondes
        // Cela permet de faire apparaître la salle d'attente automatiquement quand l'IA se met en pause !
        const intervalId = setInterval(() => {
            fetchProjectData();
        }, 5000);

        return () => clearInterval(intervalId); // Nettoyage quand on quitte le composant
    }, [activeProjectId]);

    // --- RÉCUPÉRATION DES DONNÉES ---
    const fetchProjectData = async () => {
        try {
            // /!\ Attention : Assure-toi d'avoir une route GET /projects/:id dans ton backend
            const res = await api.get(`/projects/${activeProjectId}`); 
            setCopilotMode(res.data.copilot_mode === 1);
            
            // Si le statut passe en pause, on charge les idées en attente
            if (res.data.status === 'PAUSED' && projectStatus !== 'PAUSED') {
                fetchPendingQueries();
            }
            setProjectStatus(res.data.status || 'IN_PROGRESS');
        } catch (err) {
            console.error("Erreur polling projet :", err);
        }
    };

    const fetchPendingQueries = async () => {
        try {
            // /!\ Attention : Assure-toi d'avoir cette route GET /projects/:id/pending-queries
            const res = await api.get(`/projects/${activeProjectId}/pending-queries`);
            const queries = res.data.map(q => q.query);
            
            setSuggestedQueries(queries);
            setApprovedQueries(queries); // Pré-cochées par défaut
            
            if (res.data.length > 0) {
                setCurrentDepth(res.data[0].depth);
            }
        } catch (err) {
            console.error("Erreur chargement des pistes en attente :", err);
        }
    };

    // --- ACTIONS COPILOTE ---
    const handleToggleCopilot = async () => {
        if (!activeProjectId) return;
        const newMode = !copilotMode;
        setCopilotMode(newMode); // Mise à jour UI instantanée
        
        try {
            await api.put(`/research/${activeProjectId}/copilot`, { copilot_mode: newMode });
        } catch (error) {
            alert("Erreur lors du changement de mode.");
            setCopilotMode(!newMode); // Rollback
        }
    };

    const toggleQueryApproval = (query) => {
        if (approvedQueries.includes(query)) {
            setApprovedQueries(approvedQueries.filter(q => q !== query));
        } else {
            setApprovedQueries([...approvedQueries, query]);
        }
    };

    const handleAddCustomQuery = () => {
        if (customQuery.trim() !== '' && !approvedQueries.includes(customQuery)) {
            setApprovedQueries([...approvedQueries, customQuery.trim()]);
            setCustomQuery('');
        }
    };

    const handleResumeResearch = async () => {
        if (approvedQueries.length === 0) {
            alert("Veuillez valider au moins une piste !");
            return;
        }
        try {
            setProjectStatus('IN_PROGRESS'); // Cache la salle d'attente
            await api.post(`/research/${activeProjectId}/resume`, {
                approvedQueries,
                currentDepth
            });
            setStatusMsg(`✅ L'agent repart avec ${approvedQueries.length} pistes !`);
            setSuggestedQueries([]);
            setApprovedQueries([]);
        } catch (error) {
            alert("Erreur lors de la relance.");
            setProjectStatus('PAUSED'); // Rollback
        }
    };

    // --- ACTIONS EXISTANTES ---
    const startAutonomousLoop = async () => {
        if (!activeProjectId) return;
        const confirmLoop = window.confirm(
            "🤖 Voulez-vous lancer l'Agent Deep Research ?\n\nL'IA va identifier les manques et relancer des recherches."
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
        if (!activeProjectId) {
            setStatusMsg("❌ Impossible : Veuillez sélectionner un projet.");
            return;
        }
        if (!topic) return;

        setIsLoading(true);
        setStatusMsg("⏳ Connexion au serveur...");

        try {
            const res = await api.post('/research/start', { 
                topic, 
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

            {/* 🎛️ NOUVEAU : Toggle Copilote */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                    <input 
                        type="checkbox" 
                        checked={copilotMode} 
                        onChange={handleToggleCopilot} 
                        disabled={!activeProjectId}
                        style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{ 
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                        backgroundColor: copilotMode ? '#4f46e5' : '#ccc', transition: '.4s', borderRadius: '24px' 
                    }}>
                        <span style={{
                            position: 'absolute', content: '""', height: '16px', width: '16px', left: '4px', bottom: '4px',
                            backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                            transform: copilotMode ? 'translateX(26px)' : 'translateX(0)'
                        }}></span>
                    </span>
                </label>
                <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Mode Copilote (Human-in-the-Loop)</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {copilotMode ? "L'IA s'arrêtera pour demander votre validation." : "L'IA travaille en autonomie complète."}
                    </span>
                </div>
                {/* Badge de statut du projet */}
                <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: projectStatus === 'PAUSED' ? '#fef3c7' : '#dcfce7', color: projectStatus === 'PAUSED' ? '#d97706' : '#166534' }}>
                    {projectStatus === 'PAUSED' ? 'EN PAUSE' : 'ACTIF'}
                </div>
            </div>

            {/* 🛑 NOUVEAU : La Salle d'attente (Affichée uniquement si en PAUSE) */}
            {projectStatus === 'PAUSED' && (
                <div style={{ border: '2px dashed #f59e0b', padding: '15px', borderRadius: '8px', backgroundColor: '#fffbeb', marginBottom: '20px' }}>
                    <h4 style={{ color: '#d97706', marginTop: 0 }}>🛑 L'IA attend vos instructions</h4>
                    <p style={{ fontSize: '0.85rem' }}>Voici les pistes générées à la fin du cycle {currentDepth - 1} :</p>
                    
                    <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
                        {suggestedQueries.map((query, index) => (
                            <li key={index} style={{ marginBottom: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={approvedQueries.includes(query)} 
                                        onChange={() => toggleQueryApproval(query)} 
                                    />
                                    {query}
                                </label>
                            </li>
                        ))}
                    </ul>

                    {/* Ajout manuel */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <input 
                            type="text" 
                            value={customQuery} 
                            onChange={(e) => setCustomQuery(e.target.value)} 
                            placeholder="Ajouter une piste manuelle..."
                            style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                        />
                        <button type="button" onClick={handleAddCustomQuery} style={{ padding: '6px 12px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '4px' }}>
                            +
                        </button>
                    </div>

                    {/* Pistes ajoutées manuellement */}
                    {approvedQueries.filter(q => !suggestedQueries.includes(q)).length > 0 && (
                        <div style={{ marginTop: '15px', fontSize: '0.85rem' }}>
                            <strong>Pistes ajoutées manuellement :</strong>
                            <ul style={{ paddingLeft: '20px', color: '#166534' }}>
                                {approvedQueries.filter(q => !suggestedQueries.includes(q)).map((q, idx) => (
                                    <li key={idx}>{q}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button 
                        onClick={handleResumeResearch} 
                        style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        🟢 Valider & Relancer la machine
                    </button>
                </div>
            )}

            {/* --- ANCIEN FORMULAIRE D'ASPIRATION --- */}
            <form onSubmit={handleStartResearch} className="research-form" style={{ opacity: projectStatus === 'PAUSED' ? 0.5 : 1, pointerEvents: projectStatus === 'PAUSED' ? 'none' : 'auto' }}>
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
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>🤖 Mode Agent Autonome :</span>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Laisse l'IA combler les lacunes en relançant des recherches en boucle.</p>
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
                        🚀 Lancer l'exploration
                    </button>
                </div>

                <button type="submit" disabled={isLoading} className="btn-research" style={{ marginTop: '15px' }}>
                    {isLoading ? "Envoi de la commande..." : "🚀 Lancer l'aspiration des données"}
                </button>
            </form>

            {statusMsg && (
                <div className="status-msg-box" style={{ marginTop: '15px' }}>
                    {statusMsg}
                </div>
            )}
        </div>
    );
}

export default ResearchPanel;