import { useState, useEffect } from 'react';
import api from '../api';
import { 
    BarChart, Bar, PieChart, Pie, LineChart, Line, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, Cell 
} from 'recharts';

// Couleurs professionnelles pour les graphiques
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

function GraphPanel({ activeProjectId }) {
    const [charts, setCharts] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    // États du constructeur de graphique
    const [newTitle, setNewTitle] = useState('Mon nouveau graphique');
    const [newType, setNewType] = useState('bar'); // 'bar', 'pie', 'line'
    const [newData, setNewData] = useState([
        { name: 'Donnée A', value: 10 },
        { name: 'Donnée B', value: 25 },
        { name: 'Donnée C', value: 15 }
    ]);

    useEffect(() => {
        if (activeProjectId) fetchCharts();
    }, [activeProjectId]);

    const fetchCharts = async () => {
        try {
            const res = await api.get(`/projects/${activeProjectId}/charts`);
            setCharts(res.data);
        } catch (err) {
            console.error("Erreur de récupération des graphiques :", err);
        }
    };

    const handleDataChange = (index, field, val) => {
        const updated = [...newData];
        updated[index][field] = field === 'value' ? Number(val) : val;
        setNewData(updated);
    };

    const handleAddDataPoint = () => {
        setNewData([...newData, { name: `Nouvelle donnée ${newData.length + 1}`, value: 0 }]);
    };

    const handleRemoveDataPoint = (index) => {
        setNewData(newData.filter((_, i) => i !== index));
    };

    const handleSaveChart = async () => {
        try {
            await api.post(`/projects/${activeProjectId}/charts`, {
                title: newTitle,
                chart_type: newType,
                chart_data: newData
            });
            setIsCreating(false);
            fetchCharts(); // Rafraîchir la liste
        } catch (err) {
            alert("Erreur lors de la sauvegarde du graphique.");
        }
    };

    // Fonction pour dessiner le bon graphique selon le type
    const renderChart = (type, data) => {
        if (!data || data.length === 0) return <p>Aucune donnée.</p>;

        switch (type) {
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-base)', border: 'none', borderRadius: '8px' }}/>
                            <Legend />
                            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'bar':
            default:
                return (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-base)', border: 'none', borderRadius: '8px' }}/>
                            <Legend />
                            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <div className="panel" style={{ minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>📈 Studio de Graphiques BI</h3>
                <button onClick={() => setIsCreating(!isCreating)} className={isCreating ? "btn-danger" : "btn-primary"}>
                    {isCreating ? '✖ Annuler' : '➕ Créer un Graphique'}
                </button>
            </div>

            {/* CONSTRUCTEUR DE GRAPHIQUE */}
            {isCreating && (
                <div style={{ backgroundColor: 'var(--bg-hover)', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--primary)' }}>
                    <h4 style={{ marginTop: 0 }}>🛠️ Construire votre graphique</h4>
                    
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ flexGrow: 1 }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Titre du graphique</label>
                            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Type de graphique</label>
                            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                                <option value="bar">📊 Diagramme en barres</option>
                                <option value="pie">🥧 Camembert (Pie)</option>
                                <option value="line">📈 Courbe d'évolution</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                        {/* Éditeur de données */}
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Données</label>
                            {newData.map((point, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <input type="text" value={point.name} onChange={(e) => handleDataChange(idx, 'name', e.target.value)} placeholder="Nom (Ex: 2024)" />
                                    <input type="number" value={point.value} onChange={(e) => handleDataChange(idx, 'value', e.target.value)} placeholder="Valeur" style={{ width: '100px' }} />
                                    <button onClick={() => handleRemoveDataPoint(idx)} className="btn-danger btn-small" title="Supprimer">🗑️</button>
                                </div>
                            ))}
                            <button onClick={handleAddDataPoint} className="btn-secondary btn-small" style={{ marginTop: '10px' }}>➕ Ajouter une ligne</button>
                        </div>
                        
                        {/* Aperçu en direct */}
                        <div style={{ backgroundColor: 'var(--bg-base)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <h5 style={{ margin: '0 0 15px 0', textAlign: 'center', color: 'var(--text-muted)' }}>👁️ Aperçu en direct</h5>
                            {renderChart(newType, newData)}
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <button onClick={handleSaveChart} style={{ backgroundColor: 'var(--success)' }}>💾 Sauvegarder ce graphique</button>
                    </div>
                </div>
            )}

            {/* AFFICHAGE DES GRAPHIQUES SAUVEGARDÉS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {charts.length === 0 && !isCreating && (
                    <p style={{ color: 'var(--text-muted)' }}>Aucun graphique personnalisé pour ce projet. Cliquez sur "Créer un graphique" pour commencer !</p>
                )}
                
                {charts.map(chart => (
                    <div key={chart.id} style={{ backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h4 style={{ marginTop: 0, textAlign: 'center', color: 'var(--text-main)' }}>{chart.title}</h4>
                        {renderChart(chart.chart_type, chart.chart_data)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GraphPanel;