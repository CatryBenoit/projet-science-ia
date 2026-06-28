import { useState, useEffect } from 'react';
import api from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Au chargement, on vérifie si l'utilisateur a une session active sur le Backend
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await api.get('/auth/me');
                setUser(res.data);
            } catch (err) {
                setUser(null); // Pas connecté
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLogout = async () => {
        await api.post('/auth/logout');
        setUser(null);
    };

    if (loading) return <div className="loading">Chargement...</div>;

    return (
        <div className="app-container">
            {!user ? (
                <Login onLogin={(userData) => setUser(userData)} />
            ) : (
                <Dashboard user={user} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;