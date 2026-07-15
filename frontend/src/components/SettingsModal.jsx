import { useState, useEffect } from 'react';
import api from '../api';

function SettingsModal({ onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('meta-llama/llama-3.1-70b-instruct');
    const [apiBaseUrl, setApiBaseUrl] = useState('https://openrouter.ai/api/v1');
    const [maxIterations, setMaxIterations] = useState(2);
    const [status, setStatus] = useState('');

    useEffect(() => {
        api.get('/settings').then(res => {
            if (res.data.api_key) setApiKey(res.data.api_key);
            if (res.data.ai_model) setAiModel(res.data.ai_model);
            if (res.data.api_base_url) setApiBaseUrl(res.data.api_base_url);
            if (res.data.max_iterations) setMaxIterations(res.data.max_iterations);
        });
    }, []);

    const applyPreset = (type) => {
        if (type === 'openrouter') {
            setApiBaseUrl('https://openrouter.ai/api/v1');
            setAiModel('meta-llama/llama-3.1-70b-instruct');
        } else if (type === 'ollama') {
            setApiBaseUrl('http://localhost:11434/v1');
            setAiModel('llama3:8b'); // Modèle standard fréquemment installé sur Ollama
        } else if (type === 'lmstudio') {
            setApiBaseUrl('http://localhost:1234/v1');
            setAiModel('local-model');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus('Sauvegarde...');
        try {
            await api.post('/settings', { 
                api_key: apiKey, 
                ai_model: aiModel,
                api_base_url: apiBaseUrl,
                max_iterations: parseInt(maxIterations)
            });
            setStatus('✅ Enregistré et appliqué instantanément !');
            setTimeout(onClose, 1500);
        } catch (err) {
            setStatus('❌ Erreur de sauvegarde');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <h4>⚙️ Souveraineté & Moteur IA</h4>
                    <button className="btn-secondary btn-small" onClick={onClose}>Fermer</button>
                </div>
                <form onSubmit={handleSave} className="modal-body">
                    
                    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>⚡ Configuration rapide (Presets) :</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('openrouter')}>☁️ OpenRouter (Cloud)</button>
                            <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('ollama')}>🦙 Ollama (Local)</button>
                            <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('lmstudio')}>💻 LM Studio (Local)</button>
                        </div>
                    </div>

                    <label style={{ display:'block', marginBottom:'6px', color:'var(--text-muted)', fontWeight:'bold' }}>
                        URL de l'API (Base URL) :
                    </label>
                    <input 
                        type="text" 
                        value={apiBaseUrl} 
                        onChange={e => setApiBaseUrl(e.target.value)} 
                        placeholder="https://openrouter.ai/api/v1" 
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '15px' }}>
                        Pointe vers votre serveur cloud ou local (ex: http://localhost:11434/v1 pour Ollama).
                    </p>

                    <label style={{ display:'block', marginBottom:'6px', color:'var(--text-muted)', fontWeight:'bold' }}>
                        Modèle IA cible :
                    </label>
                    <input 
                        type="text" 
                        value={aiModel} 
                        onChange={e => setAiModel(e.target.value)} 
                        placeholder="ex: llama3:8b ou anthropic/claude-3.5-sonnet" 
                    />

                    <label style={{ display:'block', marginTop:'15px', marginBottom:'6px', color:'var(--text-muted)', fontWeight:'bold' }}>
                        Clé API :
                    </label>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={e => setApiKey(e.target.value)} 
                        placeholder="sk-or-v1-... (inutile pour Ollama en local)" 
                    />

                    <hr style={{ borderColor: 'var(--border)', margin: '20px 0' }} />

                    <label style={{ display:'block', marginBottom:'6px', color:'var(--text-muted)', fontWeight:'bold' }}>
                        🔄 Profondeur de recherche autonome (Itérations max) :
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            value={maxIterations} 
                            onChange={e => setMaxIterations(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)', width: '30px' }}>{maxIterations}x</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                        Détermine combien de fois l'IA peut relancer l'aspirateur en boucle pour creuser un sujet.
                    </p>

                    <button type="submit" style={{ marginTop: '20px', width: '100%', backgroundColor: 'var(--primary)' }}>
                        💾 Enregistrer les paramètres
                    </button>
                    {status && <p style={{ textAlign: 'center', marginTop: '15px', color: 'var(--success)', fontWeight: 'bold' }}>{status}</p>}
                </form>
            </div>
        </div>
    );
}

export default SettingsModal;