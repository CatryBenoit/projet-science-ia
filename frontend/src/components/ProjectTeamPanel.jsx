import { useState, useEffect } from 'react';
import api from '../api';

function ProjectTeamPanel({ activeProjectId }) {
    const [members, setMembers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    
    // États du formulaire d'ajout
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('member');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (activeProjectId) {
            fetchMembers();
            fetchAvailableUsers();
        }
    }, [activeProjectId]);

    const fetchMembers = async () => {
        try {
            const res = await api.get(`/projects/${activeProjectId}/members`);
            setMembers(res.data);
        } catch (err) {
            console.error("Erreur récupération membres:", err);
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            const res = await api.get('/projects/users-list');
            setAvailableUsers(res.data);
        } catch (err) {
            console.error("Erreur récupération utilisateurs:", err);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!selectedUserId) return alert("Veuillez sélectionner un utilisateur.");

        setIsLoading(true);
        try {
            await api.post(`/projects/${activeProjectId}/members`, { 
                userId: selectedUserId, 
                role: selectedRole 
            });
            setSelectedUserId(''); // Reset
            fetchMembers(); // Met à jour la liste
        } catch (err) {
            alert(`❌ ${err.response?.data?.error || "Erreur lors de l'ajout."}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveMember = async (userId, username) => {
        if (!window.confirm(`Retirer ${username} de ce projet ?`)) return;

        try {
            await api.delete(`/projects/${activeProjectId}/members/${userId}`);
            fetchMembers();
        } catch (err) {
            alert("❌ Erreur lors du retrait du membre.");
        }
    };

    // Filtrer les utilisateurs pour ne pas afficher ceux qui sont DÉJÀ dans le projet
    const usersNotInProject = availableUsers.filter(
        user => !members.find(member => member.id === user.id)
    );

    return (
        <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0 }}>🤝 Équipe du Projet #{activeProjectId}</h3>
            
            {/* FORMULAIRE D'AJOUT */}
            <div style={{ backgroundColor: 'var(--bg-hover)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>➕ Inviter un collaborateur</h4>
                <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select 
                        value={selectedUserId} 
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        style={{ flexGrow: 1, margin: 0 }}
                    >
                        <option value="">-- Choisir un utilisateur --</option>
                        {usersNotInProject.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.username}
                            </option>
                        ))}
                    </select>

                    <select 
                        value={selectedRole} 
                        onChange={(e) => setSelectedRole(e.target.value)}
                        style={{ margin: 0 }}
                    >
                        <option value="member">Membre (Lecture/Écriture)</option>
                        <option value="admin">Admin (Gestion)</option>
                    </select>

                    <button type="submit" disabled={isLoading || !selectedUserId} className="btn-secondary">
                        {isLoading ? '...' : 'Ajouter'}
                    </button>
                </form>
                {usersNotInProject.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0 }}>
                        Tous les utilisateurs existants font déjà partie de ce projet.
                    </p>
                )}
            </div>

            {/* LISTE DES MEMBRES */}
            <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>Utilisateur</th>
                            <th style={{ textAlign: 'left' }}>Rôle dans le projet</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(member => (
                            <tr key={member.id}>
                                <td style={{ fontWeight: 'bold' }}>👤 {member.username}</td>
                                <td>
                                    <span style={{ 
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                                        backgroundColor: member.role === 'admin' ? '#fee2e2' : 'var(--bg-base)', 
                                        color: member.role === 'admin' ? '#ef4444' : 'var(--text-muted)',
                                        border: '1px solid var(--border)'
                                    }}>
                                        {member.role === 'admin' ? 'Chef de Projet' : 'Contributeur'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className="btn-danger btn-small"
                                        onClick={() => handleRemoveMember(member.id, member.username)}
                                    >
                                        Retirer
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {members.length === 0 && (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Personne n'est assigné à ce projet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ProjectTeamPanel;