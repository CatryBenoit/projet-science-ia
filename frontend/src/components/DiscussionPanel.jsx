import { useState, useEffect, useRef } from 'react';
import api from '../api';

function DiscussionPanel({ activeProjectId, currentUser }) {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (activeProjectId) fetchNotes();
    }, [activeProjectId]);

    // Faire défiler automatiquement vers le bas quand une note est ajoutée
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [notes]);

    const fetchNotes = async () => {
        try {
            const res = await api.get(`/projects/${activeProjectId}/notes`);
            setNotes(res.data);
        } catch (err) {
            console.error("Erreur de récupération des notes :", err);
        }
    };

    const handleSendNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        setIsLoading(true);
        try {
            await api.post(`/projects/${activeProjectId}/notes`, { content: newNote });
            setNewNote('');
            fetchNotes(); // On recharge les notes
        } catch (err) {
            alert("Erreur lors de l'envoi du message.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="panel" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0 }}>💬 Espace de discussion</h3>
            
            {/* Zone d'affichage des messages */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '15px', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {notes.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                        Aucune discussion pour ce projet. Lancez le sujet !
                    </p>
                ) : (
                    notes.map(note => {
                        const isMe = currentUser?.username === note.username;
                        return (
                            <div key={note.id} style={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                backgroundColor: isMe ? 'var(--primary)' : 'var(--bg-hover)',
                                color: isMe ? 'white' : 'var(--text-main)',
                                padding: '10px 15px',
                                borderRadius: '12px',
                                maxWidth: '80%',
                                border: isMe ? 'none' : '1px solid var(--border)'
                            }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px', opacity: 0.8 }}>
                                    {note.username} • {new Date(note.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </div>
                                <div style={{ fontSize: '0.9rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                    {note.content}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Formulaire d'envoi */}
            <form onSubmit={handleSendNote} style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <textarea 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Écrivez une note à votre équipe..."
                    style={{ flexGrow: 1, height: '50px', resize: 'none', margin: 0, padding: '10px' }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendNote(e);
                        }
                    }}
                />
                <button type="submit" disabled={isLoading || !newNote.trim()} style={{ height: '50px' }}>
                    {isLoading ? '...' : 'Envoyer'}
                </button>
            </form>
        </div>
    );
}

export default DiscussionPanel;