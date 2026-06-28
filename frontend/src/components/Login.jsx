import { useState } from 'react';
import api from '../api';

function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/login', { username, password });
            onLogin(response.data); // On envoie les infos de l'utilisateur à App.jsx
        } catch (err) {
            setError(err.response?.data?.error || "Erreur de connexion");
        }
    };

    return (
        <div className="card login-card">
            <h2>Connexion</h2>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    placeholder="Identifiant" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Mot de passe" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                />
                <button type="submit">Se connecter</button>
            </form>
        </div>
    );
}

export default Login;