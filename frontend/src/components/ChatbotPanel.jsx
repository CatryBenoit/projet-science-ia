import { useState } from 'react';
import api from '../api';

function ChatbotPanel({ activeProjectId }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Bonjour ! Je suis votre Copilote. Posez-moi des questions sur les articles de ce projet.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !activeProjectId) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await api.post(`/ai/projects/${activeProjectId}/chat`, { question: userMsg });
            setMessages(prev => [...prev, { role: 'ai', text: res.data.answer }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: '❌ Erreur de connexion au serveur IA.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>💬 Copilote IA</h3>
            
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', padding: '10px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ 
                        marginBottom: '10px', 
                        textAlign: msg.role === 'user' ? 'right' : 'left' 
                    }}>
                        <span style={{ 
                            display: 'inline-block', 
                            padding: '8px 12px', 
                            borderRadius: '8px', 
                            backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-hover)',
                            color: 'var(--text-main)',
                            maxWidth: '85%',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.9rem'
                        }}>
                            {msg.role === 'ai' ? '🤖 ' : '👤 '}{msg.text}
                        </span>
                    </div>
                ))}
                {isLoading && (
                    <div style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        🤖 L'IA analyse les articles...
                    </div>
                )}
            </div>

            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="Posez une question sur vos données..." 
                    style={{ margin: 0, flex: 1 }}
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                    Envoyer
                </button>
            </form>
        </div>
    );
}

export default ChatbotPanel;