import React from 'react';

// Composant qui prend la chaîne JSON de la BDD et affiche un badge
const ConflictBadge = ({ conflictString }) => {
    // 1. S'il n'y a pas encore d'analyse, on ne s'affiche pas
    if (!conflictString) return null; 

    let conflictData;
    try {
        // 2. On transforme le texte de la base de données en objet JavaScript
        conflictData = JSON.parse(conflictString);
    } catch (e) {
        return null;
    }

    // 3. Cas A : L'éthique est clean
    if (!conflictData.hasConflict) {
        return (
            <span style={{ fontSize: '0.8rem', color: '#166534', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px' }}>
                ✅ Éthique validée
            </span>
        );
    }

    // 4. Cas B : ALERTE ROUGE 🚩
    const severityColors = {
        LOW: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },     // Orange clair
        MEDIUM: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },  // Rouge clair
        HIGH: { bg: '#7f1d1d', text: '#fef2f2', border: '#ef4444' }     // Rouge foncé / Blanc
    };

    const theme = severityColors[conflictData.severity] || severityColors.MEDIUM;

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '10px', position: 'relative' }} className="conflict-badge-container">
            <span 
                // Le "title" permet d'afficher l'explication du détective quand on survole avec la souris !
                title={conflictData.details} 
                style={{ 
                    backgroundColor: theme.bg, 
                    color: theme.text, 
                    border: `1px solid ${theme.border}`,
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold',
                    cursor: 'help',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}
            >
                🚩 Conflit {conflictData.severity}
            </span>
        </div>
    );
};

export default ConflictBadge; // (À retirer si tu mets ça dans le même fichier que ta liste)