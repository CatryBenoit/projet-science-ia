import { useState, useEffect } from 'react';
import api from '../api';
import AdminPanel from './AdminPanel';
import ResearchPanel from './ResearchPanel';
import LibraryPanel from './LibraryPanel';
import ProjectPanel from './ProjectPanel';
import SynthesisPanel from './SynthesisPanel';

function Dashboard({ user, onLogout }) {
    const [isOnline, setIsOnline] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [wolMessage, setWolMessage] = useState('');
    const [activeProjectId, setActiveProjectId] = useState(null); 
    // Vérification du statut du PC toutes les 5 secondes
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get('/wol/status');
                setIsOnline(res.data.isOnline);
            } catch (err) {
                console.error("Erreur Ping:", err);
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleWake = async () => {
        try {
            const res = await api.post('/wol/wake');
            setWolMessage(`✅ ${res.data.message}`);
        } catch (err) {
            setWolMessage(`❌ ${err.response?.data?.error || "Erreur WOL"}`);
        }
    };

    const handleAskAi = async () => {
        if (!prompt) return;
        setIsThinking(true);
        setAiResponse('');
        try {
            // Ici on appelle la route NVIDIA que nous avons créée
            const res = await api.post('/ai/ask-nvidia', { prompt });
            setAiResponse(res.data.reply);
        } catch (err) {
            setAiResponse(`❌ ${err.response?.data?.error || "Erreur IA"}`);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="dashboard">
            <header className="dash-header">
                <h2>Bienvenue, {user.username}</h2>
                <button onClick={onLogout} className="btn-danger">Déconnexion</button>
            </header>

            <ProjectPanel 
                activeProjectId={activeProjectId} 
                setActiveProjectId={setActiveProjectId} 
            />

            {/* Carte Wake on LAN */}
            <div className="card">
                <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
                    <span className="dot"></span>
                    {isOnline ? "PC IA ALLUMÉ" : "PC IA ÉTEINT"}
                </div>
                
                <button onClick={handleWake} disabled={isOnline} className="btn-large">
                    {isOnline ? "Le PC est allumé" : "🖥️ ALLUMER LE PC"}
                </button>
                {wolMessage && <p className="wol-msg">{wolMessage}</p>}
            </div>

            {/* NOUVEAU : Le panneau de recherche scientifique */}
            <ResearchPanel activeProjectId={activeProjectId}/>

            <LibraryPanel />

            <SynthesisPanel activeProjectId={activeProjectId} />

            {/* Carte de discussion avec l'IA (NVIDIA/Ollama) */}
            <div className="card ai-card">
                <h3>🧠 Interroger l'IA</h3>
                <textarea 
                    rows="4" 
                    placeholder="Pose ta question ici..." 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                <button onClick={handleAskAi} disabled={isThinking} className="btn-ai">
                    {isThinking ? "L'IA réfléchit..." : "Envoyer à l'IA"}
                </button>

                {aiResponse && (
                    <div className="ai-response">
                        {aiResponse}
                    </div>
                )}
            </div>

            {/* Affiche le panel admin uniquement si l'utilisateur a le rôle admin */}
            {user.role === 'admin' && <AdminPanel />}
        </div>
    );
}

export default Dashboard;