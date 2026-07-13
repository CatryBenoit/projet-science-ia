import { useState, useEffect } from 'react';
import api from '../api';

function SettingsModal({ onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('meta-llama/llama-3.1-70b-instruct');
    const [status, setStatus] = useState('');

    useEffect(() => {
        api.get('/settings').then(res => {
            if (res.data.api_key) setApiKey(res.data.api_key);
            if (res.data.ai_model) setAiModel(res.data.ai_model);
        });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus('Sauvegarde...');
        try {
            await api.post('/settings', { api_key: apiKey, ai_model: aiModel });
            setStatus('✅ Enregistré avec succès !');
            setTimeout(onClose, 1500);
        } catch (err) {
            setStatus('❌ Erreur de sauvegarde');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h4>⚙️ Paramètres de l'IA</h4>
                    <button className="btn-secondary btn-small" onClick={onClose}>Fermer</button>
                </div>
                <form onSubmit={handleSave} className="modal-body">
                    <label style={{ display:'block', marginBottom:'8px', color:'var(--text-muted)' }}>
                        Clé API OpenRouter personnelle :
                    </label>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={e => setApiKey(e.target.value)} 
                        placeholder="sk-or-v1-..." 
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-10px' }}>
                        Laissez vide pour utiliser la clé par défaut du serveur.
                    </p>

                    <label style={{ display:'block', marginTop:'15px', marginBottom:'8px', color:'var(--text-muted)' }}>
                        Moteur d'Intelligence Artificielle :
                    </label>
                    <select value={aiModel} onChange={e => setAiModel(e.target.value)}>
                        <optgroup label="Modèles Rapides & Gratuits">
                            <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B (Recommandé)</option>
                            <option value="google/gemini-pro">Google Gemini Pro</option>
                        </optgroup>
                        <optgroup label="Modèles Premium (Plus intelligents)">
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Idéal pour la Data)</option>
                            <option value="openai/gpt-4o">OpenAI GPT-4o (Idéal pour le raisonnement)</option>
                        </optgroup>
                    </select>

                    <button type="submit" style={{ marginTop: '25px', width: '100%' }}>
                        💾 Sauvegarder les préférences
                    </button>
                    {status && <p style={{ textAlign: 'center', marginTop: '15px', color: 'var(--success)' }}>{status}</p>}
                </form>
            </div>
        </div>
    );
}

export default SettingsModal;