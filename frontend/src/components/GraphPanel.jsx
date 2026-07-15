import { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../api';

function GraphPanel({ activeProjectId }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [ignoredTopics, setIgnoredTopics] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchGraph = useCallback(async () => {
        if (!activeProjectId) return;
        setIsLoading(true);
        try {
            const res = await api.get(`/projects/${activeProjectId}/graph`);
            setNodes(res.data.nodes || []);
            setEdges(res.data.edges || []);
            setIgnoredTopics(res.data.ignored_topics || []);
            setSelectedNode(null);
        } catch (err) {
            console.error("Erreur chargement graphe:", err);
        } finally {
            setIsLoading(false);
        }
    }, [activeProjectId, setNodes, setEdges]);

    useEffect(() => {
        fetchGraph();
    }, [fetchGraph]);

    // Gestion du clic sur une bulle
    const onNodeClick = (event, node) => {
        if (node.data && node.data.type === 'theme') {
            setSelectedNode(node);
        } else {
            setSelectedNode(null);
        }
    };

    // Action : Élaguer la branche
    const pruneTopic = async () => {
        if (!selectedNode || !selectedNode.data.themeName) return;
        
        try {
            await api.post(`/projects/${activeProjectId}/prune`, {
                topic: selectedNode.data.themeName
            });
            alert(`✂️ Branche "[${selectedNode.data.themeName}]" élaguée ! L'IA l'ignorera dans les prochaines synthèses.`);
            fetchGraph(); // On rafraîchit le graphe pour faire disparaître la branche
        } catch (err) {
            alert("Erreur lors de l'élagage.");
        }
    };

    return (
        <div className="card" style={{ height: '550px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {/* EN-TÊTE DE COMMANDE ET BANDEAU D'ÉLAGAGE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', zIndex: 10 }}>
                <div>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>🕸️ Graphe Sémantique & Élagage</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cliquez sur une catégorie verte pour l'élaguer si elle dérive de votre sujet.</p>
                </div>

                {selectedNode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-base)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            Sélection : [{selectedNode.data.themeName}]
                        </span>
                        <button 
                            onClick={pruneTopic} 
                            className="btn-small" 
                            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}
                            title="Bannir ce sujet des synthèses et recherches futures"
                        >
                            ✂️ Élaguer cette branche
                        </button>
                    </div>
                )}
            </div>

            {/* ZONE DU GRAPHE INTERACTIF */}
            <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#090d16' }}>
                {isLoading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <p>🧠 Construction de la carte mentale IA...</p>
                    </div>
                ) : nodes.length > 0 ? (
                    <ReactFlow 
                        nodes={nodes} 
                        edges={edges} 
                        onNodesChange={onNodesChange} 
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        fitView
                    >
                        <Background color="#1e293b" gap={16} />
                        <Controls />
                        <MiniMap 
                            nodeStrokeColor={(n) => {
                                if (n.style?.background) return n.style.background;
                                return '#fff';
                            }}
                            nodeColor={(n) => {
                                if (n.id === 'root') return '#4f46e5';
                                if (n.data?.type === 'theme') return '#22c55e';
                                return '#334155';
                            }}
                        />
                    </ReactFlow>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <p>Aucune donnée à afficher. Lancez une analyse d'articles pour voir apparaître le graphe.</p>
                    </div>
                )}
            </div>

            {/* PIED DE PAGE : AFFICHAGE DES SUJETS BANNIS */}
            {ignoredTopics.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', padding: '5px 0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>🚫 Branches bannies :</span>
                    {ignoredTopics.map((top, idx) => (
                        <span key={idx} style={{ fontSize: '0.75rem', background: '#451a1a', color: '#fca5a5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #7f1d1d' }}>
                            {top}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default GraphPanel;