import { useState, useEffect, useRef } from 'react';

function TerminalPanel() {
    const [logs, setLogs] = useState([]);
    const bottomRef = useRef(null);

    useEffect(() => {
        // On se connecte au flux vidéo/texte de notre backend
        const eventSource = new EventSource('http://localhost:3001/api/logs/stream');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLogs((prevLogs) => {
                // On garde seulement les 100 dernières lignes pour ne pas faire ramer le navigateur
                const newLogs = [...prevLogs, data.text];
                if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100);
                return newLogs;
            });
        };

        // Si le composant est détruit, on ferme la connexion
        return () => eventSource.close();
    }, []);

    // Scroll automatique vers le bas à chaque nouveau message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="card" style={{ background: '#0a0a0a', border: '1px solid #333' }}>
            <h3 style={{ color: '#00ff00', marginBottom: '10px', fontSize: '14px', fontFamily: 'monospace' }}>
                &gt;_ TERMINAL IA EN DIRECT
            </h3>
            
            <div style={{ 
                background: '#000', 
                padding: '15px', 
                borderRadius: '5px', 
                height: '250px', 
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                color: '#00ff00' // Vert hacker 
            }}>
                {logs.length === 0 ? (
                    <p style={{ color: '#555' }}>En attente de processus IA...</p>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '4px' }}>
                            {log}
                        </div>
                    ))
                )}
                {/* Cet élément invisible sert d'ancre pour le scroll auto */}
                <div ref={bottomRef} /> 
            </div>
        </div>
    );
}

export default TerminalPanel;