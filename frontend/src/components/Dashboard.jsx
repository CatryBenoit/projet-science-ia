import { useState } from 'react';
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

function Dashboard({ onLogout }) {
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    
    return (
        <div className="app-layout">
            {/* BARRE LATÉRALE */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>🧬 Science IA</h2>
                </div>
                <div className="sidebar-content">
                    <ProjectPanel onProjectSelect={setActiveProjectId} />
                </div>
                
                {/* J'ai rentré le bouton dans le footer pour que ce soit plus joli visuellement */}
                <div className="sidebar-footer">
                    <button onClick={() => setShowSettings(true)} className="btn-secondary" style={{ width: '100%', marginBottom: '10px' }}>
                            ⚙️ Paramètres
                    </button>
                    <button onClick={onLogout} className="btn-secondary" style={{ width: '100%' }}>
                        🚪 Déconnexion
                    </button>
                </div>
            </aside>

            {/* CONTENU PRINCIPAL */}
            <main className="main-content">
                <header className="main-header">
                    <h1>Tableau de bord de recherche</h1>
                    <p className="subtitle">
                        {activeProjectId 
                            ? `Espace de travail actif : Projet #${activeProjectId}` 
                            : 'Veuillez sélectionner ou créer un projet dans le menu latéral pour commencer.'}
                    </p>
                </header>

                {activeProjectId && (
                    <div className="dashboard-grid">

                        {/* LIGNE 0 : Export Professionnel */}
                        <div className="col-span-12">
                            <ExportPanel activeProjectId={activeProjectId} />
                        </div>
                        
                        {/* LIGNE 1 : Le moteur de recherche (Pleine largeur) */}
                        <div className="col-span-12">
                            <ResearchPanel activeProjectId={activeProjectId} />
                        </div>

                        {/* LIGNE 2 : Terminal à gauche (1/3), Bibliothèque à droite (2/3) */}
                        <div className="col-span-4">
                            <TerminalPanel />
                        </div>
                        <div className="col-span-8">
                            <LibraryPanel activeProjectId={activeProjectId} />
                        </div>
                        {/* LIGNE GRAPHE : Carte mentale IA */}
                        <div className="col-span-12">
                            <GraphPanel activeProjectId={activeProjectId} />
                        </div>

                        {/* LIGNE 3 : La Méga-Synthèse et le Chatbot */}
                        <div className="col-span-8">
                            <SynthesisPanel activeProjectId={activeProjectId} />
                        </div>
                        <div className="col-span-4">
                            <ChatbotPanel activeProjectId={activeProjectId} />
                        </div>

                        {/* LIGNE 4 : La DataViz (Pleine largeur) */}
                        <div className="col-span-12">
                            <DataVizPanel activeProjectId={activeProjectId} />
                        </div>
                    </div>
                )}
            </main>

            {/* 🛑 AJOUT ICI : La modale des paramètres s'affiche uniquement si showSettings est true */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            
        </div>
    );
}

export default Dashboard;