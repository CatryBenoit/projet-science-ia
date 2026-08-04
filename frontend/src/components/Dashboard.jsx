import { useState } from 'react';
import logo from '../assets/logo.png'; // Import du logo Curie AI
import ProjectPanel from './ProjectPanel';
import ResearchPanel from './ResearchPanel';
import LibraryPanel from './LibraryPanel';
import SynthesisPanel from './SynthesisPanel';
import TerminalPanel from './TerminalPanel';
import ChatbotPanel from './ChatbotPanel';
import SettingsModal from './SettingsModal';
import DataVizPanel from './DataVizPanel';
import ExportPanel from './ExportPanel';
import GraphPanel from './GraphPanel';
import AdminPanel from './AdminPanel';
import ProjectTeamPanel from './ProjectTeamPanel';
import DiscussionPanel from './DiscussionPanel';

function Dashboard({ user, onLogout }) {
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    // Vues possibles: 'projects', 'library', 'workspace', 'dataviz', 'admin'
    const [currentView, setCurrentView] = useState('projects');

    return (
        <div className="app-layout">
            {/* BARRE LATÉRALE */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src={logo} alt="Curie AI Logo" />
                    <h2>Curie AI</h2>
                </div>

                <div className="sidebar-content">
                    <button
                        className={`nav-button ${currentView === 'projects' ? 'active' : ''}`}
                        onClick={() => setCurrentView('projects')}
                    >
                        📁 Exploration Projets
                    </button>
                    <button
                        className={`nav-button ${currentView === 'library' ? 'active' : ''}`}
                        onClick={() => setCurrentView('library')}
                        disabled={!activeProjectId}
                    >
                        📚 Bibliothèque du Projet
                    </button>
                    <button
                        className={`nav-button ${currentView === 'workspace' ? 'active' : ''}`}
                        onClick={() => setCurrentView('workspace')}
                        disabled={!activeProjectId}
                    >
                        🔬 Espace de Travail
                    </button>
                    <button
                        className={`nav-button ${currentView === 'dataviz' ? 'active' : ''}`}
                        onClick={() => setCurrentView('dataviz')}
                        disabled={!activeProjectId}
                    >
                        📊 Visualisation
                    </button>

                    <button
                        className={`nav-button ${currentView === 'discussions' ? 'active' : ''}`}
                        onClick={() => setCurrentView('discussions')}
                        disabled={!activeProjectId}
                    >
                        💬 Discussions
                    </button>

                    {/* 👈 Corrigé : utilisation de currentView au lieu de activeView */}
                    {user?.role === 'admin' && (
                        <button
                            className={`nav-button ${currentView === 'admin' ? 'active' : ''}`}
                            onClick={() => setCurrentView('admin')}
                        >
                            👑 Administration
                        </button>
                    )}
                </div>

                <div className="sidebar-footer">
                    <button onClick={() => setShowSettings(true)} className="btn-secondary" style={{ width: '100%' }}>
                        ⚙️ Paramètres
                    </button>
                    <button onClick={onLogout} className="btn-secondary" style={{ width: '100%', color: 'var(--danger)', borderColor: '#fecaca' }}>
                        🚪 Déconnexion
                    </button>
                </div>
            </aside>

            {/* CONTENU PRINCIPAL */}
            <main className="main-content">
                <header className="main-header">
                    <div>
                        <h1>
                            {currentView === 'projects' && 'Exploration des Projets'}
                            {currentView === 'library' && 'Bibliothèque de Documents'}
                            {currentView === 'workspace' && 'Espace de Travail IA'}
                            {currentView === 'dataviz' && 'Analyses Visuelles et Graphes'}
                            {currentView === 'admin' && 'Administration Système'} {/* 👈 Nouveau titre */}
                        </h1>
                        <p className="subtitle">
                            {activeProjectId
                                ? `Projet actif : #${activeProjectId}`
                                : 'Sélectionnez un projet pour débloquer les outils.'}
                        </p>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Connecté en tant que <strong>{user?.username || 'Chercheur'}</strong>
                    </div>
                </header>

                <div className="dashboard-scroll">
                    {/* VUE 1 : PROJETS */}
                    {currentView === 'projects' && (
                        <div className="dashboard-grid">
                            <div className="col-span-4">
                                <ProjectPanel onProjectSelect={(id) => {
                                    setActiveProjectId(id);
                                }} />
                            </div>
                            <div className="col-span-8">
                                {activeProjectId ? (
                                    <ProjectTeamPanel activeProjectId={activeProjectId} />
                                ) : (
                                    <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        Sélectionnez ou créez un projet à gauche pour voir son équipe.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VUE 2 : BIBLIOTHÈQUE */}
                    {currentView === 'library' && activeProjectId && (
                        <div className="dashboard-grid">
                            <div className="col-span-12">
                                <LibraryPanel activeProjectId={activeProjectId} />
                            </div>
                            <div className="col-span-12">
                                <ExportPanel activeProjectId={activeProjectId} />
                            </div>
                        </div>
                    )}

                    {/* VUE 3 : ESPACE DE TRAVAIL */}
                    {currentView === 'workspace' && activeProjectId && (
                        <div className="dashboard-grid">
                            <div className="col-span-12">
                                <ResearchPanel activeProjectId={activeProjectId} />
                            </div>
                            <div className="col-span-8">
                                <SynthesisPanel activeProjectId={activeProjectId} />
                            </div>
                            <div className="col-span-4">
                                <ChatbotPanel activeProjectId={activeProjectId} />
                            </div>
                            <div className="col-span-12">
                                <TerminalPanel />
                            </div>
                        </div>
                    )}

                    {/* VUE 4 : DATAVIZ */}
                    {currentView === 'dataviz' && activeProjectId && (
                        <div className="dashboard-grid">
                            <div className="col-span-12">
                                <GraphPanel activeProjectId={activeProjectId} />
                            </div>
                            <div className="col-span-12">
                                <DataVizPanel activeProjectId={activeProjectId} />
                            </div>
                        </div>
                    )}

                    {/* VUE : DISCUSSIONS */}
                    {currentView === 'discussions' && activeProjectId && (
                        <div className="dashboard-grid">
                            <div className="col-span-12">
                                <DiscussionPanel activeProjectId={activeProjectId} currentUser={user} />
                            </div>
                        </div>
                    )}

                    {/* 🎯 NOUVELLE VUE : ADMINISTRATION */}
                    {currentView === 'admin' && user?.role === 'admin' && (
                        <div className="dashboard-grid">
                            <div className="col-span-12" style={{ height: '80vh' }}>
                                <AdminPanel />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
        </div>
    );
}

export default Dashboard;