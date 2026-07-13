import { useState, useEffect } from 'react';
import api from '../api';

function ProjectPanel({ onProjectSelect }) {
    const [projects, setProjects] = useState([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data);
            if (res.data.length > 0) {
                onProjectSelect(res.data[0].id);
            }
        } catch (err) {
            console.error("Erreur chargement projets", err);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            await api.post('/projects', { name: newProjectName, description: newProjectDesc });
            setNewProjectName('');
            setNewProjectDesc('');
            fetchProjects();
        } catch (err) {
            alert("Erreur lors de la création du projet");
        }
    };

    return (
        <div className="project-sidebar-widget">
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '15px', letterSpacing: '0.05em' }}>
                Vos Projets
            </h3>
            
            <select 
                onChange={(e) => onProjectSelect(e.target.value)} 
                style={{ marginBottom: '30px', fontWeight: '500' }}
            >
                {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '15px', letterSpacing: '0.05em' }}>
                Nouveau Projet
            </h3>
            <form onSubmit={handleCreateProject}>
                <input 
                    type="text" 
                    placeholder="Nom du projet" 
                    value={newProjectName} 
                    onChange={e => setNewProjectName(e.target.value)} 
                    required 
                    style={{ padding: '10px', fontSize: '0.9rem' }}
                />
                <textarea 
                    placeholder="Description (Optionnelle)" 
                    value={newProjectDesc} 
                    onChange={e => setNewProjectDesc(e.target.value)}
                    rows="3"
                    style={{ padding: '10px', fontSize: '0.9rem', resize: 'none' }}
                ></textarea>
                <button type="submit" style={{ width: '100%' }}>➕ Créer</button>
            </form>
        </div>
    );
}

export default ProjectPanel;