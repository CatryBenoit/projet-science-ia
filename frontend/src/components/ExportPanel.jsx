import { useState } from 'react';
import html2pdf from 'html2pdf.js';
import api from '../api';

function ExportPanel({ activeProjectId }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // 1. Récupérer les données du projet
            let synthesisText = "Aucune synthèse générée pour ce projet.";
            try {
                const synthRes = await api.get(`/projects/${activeProjectId}/synthesis`);
                if (synthRes.data && synthRes.data.report) {
                    synthesisText = synthRes.data.report;
                }
            } catch (e) {
                console.warn("Synthèse introuvable");
            }

            let charts = [];
            try {
                const chartsRes = await api.get(`/projects/${activeProjectId}/charts`);
                if (chartsRes.data) charts = chartsRes.data;
            } catch (e) {
                console.warn("Graphiques introuvables");
            }

            // 2. Construire un document HTML virtuel et propre pour l'impression
            const reportContainer = document.createElement('div');
            reportContainer.style.padding = '40px';
            reportContainer.style.fontFamily = 'Helvetica, Arial, sans-serif';
            reportContainer.style.color = '#0f172a';
            reportContainer.style.backgroundColor = '#ffffff'; // Fond blanc forcé pour le PDF

            let htmlContent = `
                <h1 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">Rapport de Recherche R&D</h1>
                <p style="color: #64748b; font-size: 14px;"><strong>Projet ID :</strong> #${activeProjectId}</p>
                <p style="color: #64748b; font-size: 14px;"><strong>Date de l'export :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                
                <h2 style="margin-top: 40px; color: #1e293b;">1. Synthèse de l'Intelligence Artificielle</h2>
                <div style="white-space: pre-wrap; line-height: 1.6; font-size: 14px; text-align: justify;">${synthesisText}</div>

                <h2 style="margin-top: 50px; color: #1e293b;">2. Données Statistiques et Graphiques</h2>
            `;

            if (charts.length === 0) {
                htmlContent += `<p style="font-size: 14px; font-style: italic;">Aucune donnée statistique n'a été mémorisée pour ce projet.</p>`;
            } else {
                charts.forEach((chart, index) => {
                    // Au lieu d'essayer de dessiner le SVG Recharts (complexe en PDF), on génère un beau tableau récapitulatif des données du graphique
                    htmlContent += `
                        <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h3 style="margin: 0 0 10px 0; color: #334155;">Figure ${index + 1} : ${chart.title}</h3>
                            <p style="font-size: 12px; color: #64748b; margin-bottom: 15px;">Visualisé sous forme de : ${chart.chart_type === 'bar' ? 'Histogramme' : 'Courbe de tendance'}</p>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="background-color: #f8fafc;">
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1;">Axe X (Catégorie)</th>
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1;">Axe Y (Valeur)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${chart.chart_data.map(d => `
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${d.name}</td>
                                            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #4f46e5;">${d.value}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                });
            }

            reportContainer.innerHTML = htmlContent;

            // 3. Configuration de html2pdf
            const opt = {
                margin:       [15, 15, 15, 15],
                filename:     `Rapport_ScienceIA_Projet_${activeProjectId}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // 4. Lancement de la création
            await html2pdf().set(opt).from(reportContainer).save();
            
        } catch (err) {
            alert("Erreur lors de l'export du rapport PDF.");
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
            <div>
                <h3 style={{ margin: '0 0 5px 0', color: 'var(--primary)' }}>📄 Rapport Professionnel</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Compilez la synthèse de l'IA et les tableaux de données dans un document PDF.</p>
            </div>
            <button onClick={handleExport} disabled={isExporting} style={{ backgroundColor: 'var(--success)', whiteSpace: 'nowrap' }}>
                {isExporting ? 'Génération en cours...' : '📥 Télécharger en PDF'}
            </button>
        </div>
    );
}

export default ExportPanel;