import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../api';

function DataVizPanel({ activeProjectId }) {
    const [chartData, setChartData] = useState([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chartType, setChartType] = useState('bar');
    
    // NOUVEAU : Gestion des graphiques sauvegardés
    const [savedCharts, setSavedCharts] = useState([]);

    // Charger les graphiques sauvegardés quand on change de projet
    useEffect(() => {
        if (activeProjectId) fetchSavedCharts();
    }, [activeProjectId]);

    const fetchSavedCharts = async () => {
        try {
            const res = await api.get(`/projects/${activeProjectId}/charts`);
            setSavedCharts(res.data);
        } catch (err) {
            console.error("Erreur chargement graphiques", err);
        }
    };

    const generateChart = async (e) => {
        e.preventDefault();
        if (!query.trim() || !activeProjectId) return;

        setIsLoading(true);
        setChartData([]);

        try {
            const res = await api.post(`/ai/projects/${activeProjectId}/dataviz`, { prompt: query });
            if (Array.isArray(res.data) && res.data.length > 0) {
                setChartData(res.data);
            } else {
                alert("L'IA n'a pas trouvé de données suffisantes pour ce graphique.");
            }
        } catch (err) {
            alert(err.response?.data?.error || "Erreur de génération.");
        } finally {
            setIsLoading(false);
        }
    };

    // NOUVEAU : Fonction de sauvegarde
    const saveCurrentChart = async () => {
        try {
            await api.post(`/projects/${activeProjectId}/charts`, {
                title: query, // On utilise le prompt comme titre
                chart_type: chartType,
                chart_data: chartData
            });
            alert("✅ Graphique sauvegardé pour vos rapports !");
            fetchSavedCharts(); // On rafraîchit la liste
        } catch (err) {
            alert("❌ Erreur lors de la sauvegarde.");
        }
    };

    // Permet de re-visionner un graphique sauvegardé
    const loadSavedChart = (chart) => {
        setChartData(chart.chart_data);
        setChartType(chart.chart_type);
        setQuery(chart.title);
    };

    return (
        <div className="card" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)' }}>📊 Dataviz & Graphiques IA</h3>
                
                {chartData.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                            value={chartType} 
                            onChange={(e) => setChartType(e.target.value)}
                            style={{ margin: 0, padding: '5px 10px', height: '100%' }}
                        >
                            <option value="bar">Histogramme</option>
                            <option value="line">Courbe</option>
                        </select>
                        <button className="btn-small" style={{ backgroundColor: 'var(--success)' }} onClick={saveCurrentChart}>
                            💾 Mémoriser
                        </button>
                    </div>
                )}
            </div>

            <form onSubmit={generateChart} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input 
                    type="text" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    placeholder="Ex: Compare le nombre d'effets secondaires par médicament..." 
                    style={{ margin: 0, flex: 1 }}
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !query.trim()}>
                    {isLoading ? 'Calculs...' : 'Générer'}
                </button>
            </form>

            {/* Liste des graphiques déjà sauvegardés */}
            {savedCharts.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Historique :</span>
                    {savedCharts.map(chart => (
                        <button key={chart.id} onClick={() => loadSavedChart(chart)} className="btn-secondary btn-small" style={{ whiteSpace: 'nowrap' }}>
                            📈 {chart.title.substring(0, 20)}...
                        </button>
                    ))}
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, backgroundColor: 'var(--bg-base)', borderRadius: '8px', padding: '15px' }}>
                {isLoading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <p>🤖 L'IA compile les données statistiques...</p>
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="name" stroke="var(--text-muted)" />
                                <YAxis stroke="var(--text-muted)" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : (
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="name" stroke="var(--text-muted)" />
                                <YAxis stroke="var(--text-muted)" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                                <Line type="monotone" dataKey="value" stroke="var(--success)" strokeWidth={3} dot={{ r: 5 }} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <p>Aucun graphique actif.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DataVizPanel;