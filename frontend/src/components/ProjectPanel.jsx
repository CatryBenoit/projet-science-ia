import { useState, useEffect } from 'react';
import api from '../api';

function ProjectPanel({ activeProjectId, setActiveProjectId }) {
    const [projects, setProjects] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data);
            // Si aucun projet n'est actif mais qu'on en a dans la liste, on active le premier
            if (!activeProjectId && res.data.length > 0) {
                setActiveProjectId(res.data[0].id);
            }
        } catch (err) {
            console.error("Erreur chargement projets :", err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/projects', { name, description });
            setName('');
            setDescription('');
            setIsCreating(false);
            await fetchProjects();
            setActiveProjectId(res.data.id); // On active automatiquement le nouveau projet
        } catch (err) {
            alert("Erreur lors de la création du projet");
        }
    };

    return (
        <div className="card project-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>📁 Espace de Travail</h3>
                <button onClick={() => setIsCreating(!isCreating)} className="btn-small">
                    {isCreating ? "❌ Annuler" : "➕ Nouveau Projet"}
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreateProject} className="project-form">
                    <input 
                        type="text" 
                        placeholder="Nom du projet (ex: CRISPR Cancer)" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                    />
                    <input 
                        type="text" 
                        placeholder="Description (Optionnelle)" 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                    />
                    <button type="submit" className="btn-small">Créer</button>
                </form>
            )}

            {!isCreating && projects.length > 0 && (
                <div className="project-selector">
                    <label>Projet actif : </label>
                    <select 
                        value={activeProjectId || ''} 
                        onChange={(e) => setActiveProjectId(e.target.value)}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {!isCreating && projects.length === 0 && (
                <p style={{ color: '#e74c3c', fontSize: '14px' }}>⚠️ Vous n'avez aucun projet. Créez-en un pour commencer vos recherches.</p>
            )}
        </div>
    );
}

export default ProjectPanel;