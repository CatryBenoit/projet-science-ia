import { useState } from 'react';
import api from '../api';

function AdminPanel() {
    const [newUsername, setNewUsername] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/admin/create-user', { username: newUsername, tempPassword });
            setMessage(`✅ ${res.data.message}`);
            setNewUsername('');
            setTempPassword('');
        } catch (err) {
            setMessage(`❌ ${err.response?.data?.error || "Erreur"}`);
        }
    };

    return (
        <div className="admin-box">
            <h3>🛠️ Panel Admin</h3>
            <p className="admin-msg">{message}</p>
            
            <form onSubmit={handleCreateUser} className="admin-form">
                <input 
                    type="text" 
                    placeholder="Nouvel identifiant" 
                    value={newUsername} 
                    onChange={(e) => setNewUsername(e.target.value)} 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Mot de passe temporaire" 
                    value={tempPassword} 
                    onChange={(e) => setTempPassword(e.target.value)} 
                    required 
                />
                <button type="submit" className="btn-warning">Créer l'utilisateur</button>
            </form>
        </div>
    );
}

export default AdminPanel;