import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css'; // Le style par défaut indispensable
import api from '../api';

const GraphPanel = ({ activeProjectId }) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchGraphData = async () => {
        if (!activeProjectId) return;
        setIsLoading(true);

        try {
            const res = await api.get(`/projects/${activeProjectId}/graph`);
            const { project, articles, pending } = res.data;

            const newNodes = [];
            const newEdges = [];

            // 1️⃣ NŒUD CENTRAL (Le thème du projet)
            newNodes.push({
                id: 'root',
                position: { x: 400, y: 50 }, // Tout en haut au centre
                data: { label: `🧠 Thème : ${project.core_theme || 'Sujet Central'}` },
                style: { background: '#2563eb', color: 'white', fontWeight: 'bold', borderRadius: '8px', padding: '12px', border: '2px solid #1d4ed8' }
            });

            // 2️⃣ NŒUDS ARTICLES (Ce qui a déjà été lu)
            articles.forEach((art, index) => {
                const artId = `art-${art.id}`;
                newNodes.push({
                    id: artId,
                    position: { x: 50 + (index * 220), y: 200 }, // Espacés horizontalement
                    data: { label: `📄 ${art.title.substring(0, 35)}...` },
                    style: { background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', fontSize: '12px', width: 180 }
                });
                
                // Lien vers le centre
                newEdges.push({ 
                    id: `e-root-${artId}`, 
                    source: 'root', 
                    target: artId, 
                    animated: true, 
                    style: { stroke: '#10b981', strokeWidth: 2 } 
                });
            });

            // 3️⃣ NŒUDS COPILOTE (Les idées en attente)
            pending.forEach((query, index) => {
                const qId = `query-${query.id}`;
                newNodes.push({
                    id: qId,
                    position: { x: 150 + (index * 250), y: 350 }, // Un niveau plus bas
                    data: { label: `💡 Piste IA: ${query.query}` },
                    style: { background: '#fef3c7', color: '#b45309', border: '2px dashed #f59e0b', borderRadius: '20px', fontSize: '12px', width: 200 }
                });

                // Lien pointillé vers le centre
                newEdges.push({ 
                    id: `e-root-${qId}`, 
                    source: 'root', 
                    target: qId, 
                    animated: true, 
                    style: { stroke: '#f59e0b', strokeDasharray: '5,5' } 
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);
        } catch (error) {
            console.error("Erreur de chargement du graphe :", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Recharger le graphe quand le projet change
    useEffect(() => {
        fetchGraphData();
    }, [activeProjectId]);

    // Fonctions obligatoires pour que React Flow permette de déplacer les nœuds à la souris
    const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

    if (!activeProjectId) return null;

    return (
        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>🕸️ Cartographie de la Recherche</h3>
                <button className="btn-secondary" onClick={fetchGraphData} disabled={isLoading}>
                    {isLoading ? '🔄 Scan en cours...' : '🔄 Rafraîchir la carte'}
                </button>
            </div>
            
            <div style={{ flexGrow: 1, border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', overflow: 'hidden' }}>
                <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    onNodesChange={onNodesChange} 
                    onEdgesChange={onEdgesChange} 
                    fitView // Zoom automatique pour tout voir
                    attributionPosition="bottom-right"
                >
                    <Background color="#cbd5e1" gap={16} size={1} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
};

export default GraphPanel;