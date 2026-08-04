import React, { useState, useEffect } from 'react';
import api from '../api';

const SettingsModal = ({ isOpen, onClose }) => {
    const [providers, setProviders] = useState([]);
    const [routings, setRoutings] = useState([]);
    
    // État unifié pour la création et l'édition
    const [formData, setFormData] = useState({ id: null, name: '', base_url: '', api_key: '' });
    const [testStatus, setTestStatus] = useState(null); // 'loading', 'success', 'error'

    const roles = [
        { id: 'guardrail', label: '🛡️ Guardrail (Triage)' },
        { id: 'detective', label: '🕵️ Détective (Éthique)' },
        { id: 'analysis', label: '🧠 Analyse (Extraction)' },
        { id: 'synthesis', label: '📝 Synthèse (Rapport)' },
        { id: 'inspiration', label: '💡 Inspiration (Pistes)' }
    ];

    useEffect(() => {
        if (isOpen) {
            fetchProviders();
            fetchRoutings();
        }
    }, [isOpen]);

    const fetchProviders = async () => {
        try {
            const res = await api.get('/settings/providers');
            setProviders(res.data);
        } catch (error) {
            console.error("Erreur récupération fournisseurs :", error);
        }
    };

    const fetchRoutings = async () => {
        try {
            const res = await api.get('/settings/routing');
            setRoutings(res.data);
        } catch (error) {
            console.error("Erreur récupération routings :", error);
        }
    };

    // --- GESTION DES FOURNISSEURS ---

    const handleEditProvider = (provider) => {
        setFormData({ id: provider.id, name: provider.name, base_url: provider.base_url, api_key: provider.api_key });
        setTestStatus(null);
    };

    const handleResetForm = () => {
        setFormData({ id: null, name: '', base_url: '', api_key: '' });
        setTestStatus(null);
    };

    const handleTestConnection = async () => {
        if (!formData.base_url || !formData.api_key) {
            return alert("L'URL de base et la Clé API sont requises pour le test.");
        }
        setTestStatus('loading');
        try {
            await api.post('/settings/providers/test', { base_url: formData.base_url, api_key: formData.api_key });
            setTestStatus('success');
        } catch (error) {
            setTestStatus('error');
        }
    };

    const handleSaveProvider = async () => {
        if (!formData.name || !formData.base_url || !formData.api_key) {
            return alert("Veuillez remplir tous les champs.");
        }

        try {
            if (formData.id) {
                await api.put(`/settings/providers/${formData.id}`, formData);
            } else {
                await api.post('/settings/providers', formData);
            }
            handleResetForm();
            fetchProviders();
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la sauvegarde du fournisseur.");
        }
    };

    const handleDeleteProvider = async (id) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ? Les agents qui l'utilisent basculeront sur le modèle par défaut.")) {
            try {
                await api.delete(`/settings/providers/${id}`);
                if (formData.id === id) handleResetForm();
                fetchProviders();
                fetchRoutings();
            } catch (error) {
                alert("Erreur lors de la suppression.");
            }
        }
    };

    // --- GESTION DU ROUTAGE ---

    const handleAssignRole = async (roleId, providerId, modelName) => {
        if (!providerId || !modelName) {
            return alert("Veuillez sélectionner un fournisseur et indiquer un nom de modèle.");
        }
        try {
            await api.post('/settings/routing', { provider_id: providerId, role: roleId, model_name: modelName });
            fetchRoutings();
        } catch (error) {
            alert("Erreur lors de l'assignation du rôle.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '900px' }}>
                <div className="modal-header">
                    <h4>⚙️ Configuration Avancée des Modèles IA</h4>
                    <button className="btn-secondary btn-small" onClick={onClose}>Fermer</button>
                </div>
                
                <div className="modal-body">
                    {/* SECTION 1 : FOURNISSEURS */}
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>1. Fournisseurs API</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Liste existante */}
                            <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h5 style={{ marginTop: 0, marginBottom: '12px' }}>Fournisseurs enregistrés</h5>
                                {providers.length === 0 ? (
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Aucun fournisseur.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {providers.map(p => (
                                            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-panel)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                <div>
                                                    <strong>{p.name}</strong>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.base_url}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn-secondary btn-small" onClick={() => handleEditProvider(p)}>✏️</button>
                                                    <button className="btn-danger btn-small" onClick={() => handleDeleteProvider(p.id)}>🗑️</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Formulaire Édition/Ajout */}
                            <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h5 style={{ marginTop: 0, marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                    {formData.id ? 'Éditer le fournisseur' : 'Ajouter un fournisseur'}
                                    {formData.id && <button className="btn-secondary btn-small" onClick={handleResetForm} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Annuler</button>}
                                </h5>
                                
                                <input type="text" placeholder="Nom (ex: OpenAI, Ollama Local)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                <input type="text" placeholder="URL de base (ex: http://localhost:11434/v1)" value={formData.base_url} onChange={e => setFormData({...formData, base_url: e.target.value})} />
                                <input type="password" placeholder="Clé API (Optionnelle en local)" value={formData.api_key} onChange={e => setFormData({...formData, api_key: e.target.value})} />
                                
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button onClick={handleTestConnection} className="btn-secondary" style={{ flex: 1 }}>
                                        {testStatus === 'loading' ? '⏳ Test...' : '🔌 Tester la connexion'}
                                    </button>
                                    <button onClick={handleSaveProvider} className="btn" style={{ flex: 1, backgroundColor: 'var(--success)' }}>
                                        💾 Sauvegarder
                                    </button>
                                </div>

                                {testStatus === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '10px', fontWeight: '500' }}>✅ Connexion réussie !</div>}
                                {testStatus === 'error' && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '10px', fontWeight: '500' }}>❌ Échec de la connexion. Vérifiez l'URL ou la clé.</div>}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2 : ROUTAGE */}
                    <div>
                        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>2. Assignation des Modèles (Routage)</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Agent / Rôle</th>
                                    <th>Fournisseur API</th>
                                    <th>Nom exact du modèle</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map(role => {
                                    const currentRouting = routings.find(r => r.role === role.id) || {};
                                    return (
                                        <tr key={role.id}>
                                            <td style={{ fontWeight: '500' }}>{role.label}</td>
                                            <td>
                                                <select defaultValue={currentRouting.provider_id || ""} id={`prov-${role.id}`} style={{ marginBottom: 0 }}>
                                                    <option value="" disabled>Par défaut (Global)</option>
                                                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <input type="text" defaultValue={currentRouting.model_name || ""} id={`mod-${role.id}`} placeholder="ex: llama3.1:8b" style={{ marginBottom: 0 }} />
                                            </td>
                                            <td>
                                                <button className="btn-small" style={{ backgroundColor: 'var(--success)' }} onClick={() => {
                                                    const provId = document.getElementById(`prov-${role.id}`).value;
                                                    const modName = document.getElementById(`mod-${role.id}`).value;
                                                    handleAssignRole(role.id, provId, modName);
                                                }}>
                                                    💾
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;