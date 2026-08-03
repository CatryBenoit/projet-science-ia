import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../api';

const ChatbotPanel = ({ activeProjectId }) => {
    // État pour stocker l'historique de la conversation
    const [messages, setMessages] = useState([
        { role: 'ai', text: "👋 Bonjour ! Je suis ton assistant de recherche. Pose-moi une question et j'irai chercher la réponse **uniquement** dans les PDFs de ce projet." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Référence pour faire défiler le chat automatiquement vers le bas
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !activeProjectId || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        
        // Ajout de la question de l'utilisateur à l'interface
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            // Appel à notre nouvelle route Backend
            const res = await api.post(`/projects/${activeProjectId}/chat`, { question: userMsg });
            
            // Ajout de la réponse de l'IA
            setMessages(prev => [...prev, { role: 'ai', text: res.data.answer }]);
        } catch (error) {
            console.error("Erreur Chatbot:", error);
            setMessages(prev => [...prev, { role: 'ai', text: "❌ *Une erreur de connexion est survenue.*" }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeProjectId) return null;

    return (
        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                💬 Chat avec mes articles (RAG)
            </h3>

            {/* Zone d'affichage des messages */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        style={{
                            maxWidth: '85%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.role === 'user' ? '#2563eb' : '#f1f5f9',
                            color: msg.role === 'user' ? 'white' : '#1e293b',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                    >
                        {msg.role === 'user' ? (
                            msg.text
                        ) : (
                            <div className="markdown-content" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '12px', color: '#64748b' }}>
                        <span className="typing-indicator">L'IA analyse les articles... 🧠</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Barre de saisie */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ex: Quelles sont les limites de l'étude sur..."
                    style={{ flexGrow: 1, padding: '10px 15px', borderRadius: '25px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
                <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: (isLoading || !input.trim()) ? '#94a3b8' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '25px',
                        cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default ChatbotPanel;