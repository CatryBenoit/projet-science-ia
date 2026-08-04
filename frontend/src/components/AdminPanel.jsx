import { useState, useEffect } from 'react';
import api from '../api';

function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // État pour le formulaire de création
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error("Erreur de récupération des utilisateurs :", err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) {
            return alert("Le nom d'utilisateur et le mot de passe sont requis.");
        }

        setIsLoading(true);
        try {
            await api.post('/admin/users', newUser);
            alert("✅ Utilisateur créé avec succès !");
            setNewUser({ username: '', password: '', role: 'user' }); // Reset du formulaire
            fetchUsers(); // Rafraîchissement de la liste
        } catch (err) {
            alert(`❌ Erreur : ${err.response?.data?.error || "Impossible de créer l'utilisateur."}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (id, username) => {
        if (id === 1) {
            return alert("🛡️ Sécurité : Impossible de supprimer le compte Super-Admin principal.");
        }
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur "${username}" ?`)) {
            return;
        }

        try {
            await api.delete(`/admin/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert("❌ Erreur lors de la suppression de l'utilisateur.");
        }
    };

    const handleResetPassword = async (id, username) => {
        const newPassword = window.prompt(`🔑 Entrez le NOUVEAU mot de passe pour "${username}" :`);
        if (!newPassword) return; // Annulation si le champ est vide

        try {
            await api.post('/admin/reset-password', { userId: id, newPassword });
            alert(`✅ Mot de passe de ${username} réinitialisé avec succès !`);
        } catch (err) {
            alert("❌ Erreur lors de la réinitialisation du mot de passe.");
        }
    };

    return (
        <div className="panel" style={{ height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
                <h3 style={{ margin: 0, border: 'none', padding: 0 }}>👑 Console Super-Admin</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>
                
                {/* COLONNE GAUCHE : Formulaire de création */}
                <div style={{ backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)', height: 'fit-content' }}>
                    <h4 style={{ marginTop: 0, color: 'var(--primary)' }}>➕ Ajouter un membre</h4>
                    <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Nom d'utilisateur</label>
                            <input 
                                type="text" 
                                placeholder="ex: marie_curie" 
                                value={newUser.username}
                                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Mot de passe provisoire</label>
                            <input 
                                type="text" 
                                placeholder="ex: password123" 
                                value={newUser.password}
                                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Rôle</label>
                            <select 
                                value={newUser.role}
                                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                                style={{ width: '100%', marginTop: '5px' }}
                            >
                                <option value="user">Chercheur (User)</option>
                                <option value="admin">Administrateur (Admin)</option>
                            </select>
                        </div>
                        <button type="submit" disabled={isLoading} style={{ marginTop: '10px', backgroundColor: 'var(--success)' }}>
                            {isLoading ? 'Création...' : 'Créer le compte'}
                        </button>
                    </form>
                </div>

                {/* COLONNE DROITE : Tableau des utilisateurs */}
                <div>
                    <h4 style={{ marginTop: 0, color: 'var(--text-main)' }}>👥 Équipe et Utilisateurs ({users.length})</h4>
                    <div className="table-container">
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nom d'utilisateur</th>
                                    <th>Rôle</th>
                                    <th>Actions de sécurité</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>#{user.id}</td>
                                        <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '12px', 
                                                fontSize: '0.75rem', 
                                                backgroundColor: user.role === 'admin' ? '#fee2e2' : 'var(--bg-hover)', 
                                                color: user.role === 'admin' ? '#ef4444' : 'var(--primary)',
                                                fontWeight: 'bold'
                                            }}>
                                                {user.role === 'admin' ? '👑 Admin' : '🔬 User'}
                                            </span>
                                        </td>
                                        <td style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                className="btn-secondary btn-small" 
                                                onClick={() => handleResetPassword(user.id, user.username)}
                                                title="Réinitialiser le mot de passe"
                                            >
                                                🔑 Reset
                                            </button>
                                            {user.id !== 1 && (
                                                <button 
                                                    className="btn-danger btn-small" 
                                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                                    title="Supprimer le compte"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center' }}>Aucun utilisateur trouvé.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default AdminPanel;