import React, { useState, useEffect } from 'react';
import api from '../api';

const SettingsModal = ({ isOpen, onClose }) => {
    // 1. États pour stocker les données
    const [providers, setProviders] = useState([]);
    const [routings, setRoutings] = useState([]);
    
    // État pour le formulaire d'ajout d'un nouveau fournisseur
    const [newProvider, setNewProvider] = useState({ name: '', base_url: '', api_key: '' });
    
    // Liste de nos agents/rôles
    const roles = [
        { id: 'guardrail', label: '🛡️ Guardrail (Triage rapide)' },
        { id: 'detective', label: '🕵️ Détective (Éthique)' },
        { id: 'analysis', label: '🧠 Analyse (Extraction PDF)' },
        { id: 'synthesis', label: '📝 Synthèse (Rapport final)' },
        { id: 'inspiration', label: '💡 Inspiration (Nouvelles pistes)' }
    ];

    // 2. Récupération des données au chargement
    useEffect(() => {
        if (isOpen) {
            fetchProviders();
            fetchRoutings();
        }
    }, [isOpen]);

    const fetchProviders = async () => {
        try {
            // "api" ajoute automatiquement l'URL du backend et le token !
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

    // 3. Fonctions d'action
    const handleAddProvider = async () => {
        if (!newProvider.name || !newProvider.base_url || !newProvider.api_key) {
            return alert("⚠️ Veuillez remplir tous les champs !");
        }

        try {
            await api.post('/settings/providers', newProvider);
            setNewProvider({ name: '', base_url: '', api_key: '' }); // Reset
            fetchProviders(); // Rafraîchir la liste
        } catch (error) {
            console.error(error);
            alert("❌ Erreur lors de l'ajout du fournisseur.");
        }
    };

    const handleAssignRole = async (roleId, providerId, modelName) => {
        if (!providerId || !modelName) {
            return alert("⚠️ Veuillez sélectionner un fournisseur et taper un nom de modèle !");
        }

        try {
            await api.post('/settings/routing', { 
                provider_id: providerId, 
                role: roleId, 
                model_name: modelName 
            });
            alert(`✅ Modèle assigné au rôle ${roleId} !`);
            fetchRoutings();
        } catch (error) {
            console.error(error);
            alert("❌ Erreur lors de l'assignation du rôle.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={overlayStyle}>
            <div className="modal-content" style={modalStyle}>
                <h2>⚙️ Configuration Avancée de l'IA</h2>
                
                {/* --- SECTION 1 : FOURNISSEURS API --- */}
                <div style={sectionStyle}>
                    <h3>1. Mes Fournisseurs API</h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                        {providers.map(p => (
                            <li key={p.id}><strong>{p.name}</strong> <i>({p.base_url})</i></li>
                        ))}
                        {providers.length === 0 && <li style={{color: '#666'}}>Aucun fournisseur enregistré.</li>}
                    </ul>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" placeholder="Nom (ex: NVIDIA)" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} style={inputStyle} />
                        <input type="text" placeholder="URL de base" value={newProvider.base_url} onChange={e => setNewProvider({...newProvider, base_url: e.target.value})} style={inputStyle} />
                        <input type="password" placeholder="Clé API" value={newProvider.api_key} onChange={e => setNewProvider({...newProvider, api_key: e.target.value})} style={inputStyle} />
                        <button onClick={handleAddProvider} style={btnStyle}>➕ Ajouter</button>
                    </div>
                </div>

                {/* --- SECTION 2 : ROUTAGE DES MODÈLES --- */}
                <div style={sectionStyle}>
                    <h3>2. Routage des Agents (Qui fait quoi ?)</h3>
                    <table style={{ width: '100%', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th>Agent / Rôle</th>
                                <th>Fournisseur API</th>
                                <th>Nom du modèle exact</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(role => {
                                const currentRouting = routings.find(r => r.role === role.id) || {};
                                
                                return (
                                    <tr key={role.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '10px 0' }}>{role.label}</td>
                                        <td>
                                            <select 
                                                defaultValue={currentRouting.provider_id || ""}
                                                id={`prov-${role.id}`}
                                                style={inputStyle}
                                            >
                                                <option value="" disabled>Choisir...</option>
                                                {providers.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input 
                                                type="text" 
                                                defaultValue={currentRouting.model_name || ""} 
                                                id={`mod-${role.id}`}
                                                placeholder="ex: gpt-4o" 
                                                style={inputStyle} 
                                            />
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => {
                                                    const provId = document.getElementById(`prov-${role.id}`).value;
                                                    const modName = document.getElementById(`mod-${role.id}`).value;
                                                    handleAssignRole(role.id, provId, modName);
                                                }}
                                                style={saveBtnStyle}
                                            >
                                                💾 Sauver
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ textAlign: 'right', marginTop: '20px' }}>
                    <button onClick={onClose} style={closeBtnStyle}>Fermer</button>
                </div>
            </div>
        </div>
    );
};

// --- STYLES EN LIGNE ---
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const sectionStyle = { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' };
const inputStyle = { padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' };
const btnStyle = { padding: '8px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' };
const saveBtnStyle = { padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const closeBtnStyle = { padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' };

export default SettingsModal;