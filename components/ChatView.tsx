
import React, { useState } from 'react';

const ChatView: React.FC = () => {
    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState<boolean>(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Carregar Contatos
    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/contacts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data);
            }
        } catch (error) {
            console.error('Erro ao buscar contatos', error);
        }
    };

    // Carregar Mensagens
    const fetchMessages = async (contactId: number) => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/messages/${contactId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // MANTÉM MENSAGENS PENDENTES (Que ainda não foram salvas/confirmadas)
                setMessages(prev => {
                    const pending = prev.filter(m => m.isPending);
                    // Combina server + pending
                    return [...data, ...pending];
                });

                // Só scrolla se for a primeira carga ou enviado
                if (messages.length === 0) scrollToBottom();
            }
        } catch (error) {
            console.error('Erro ao buscar mensagens', error);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedContact) return;

        const tempId = Date.now();
        try {
            const token = localStorage.getItem('myzap_token');
            // Otimista
            const tempMsg = {
                id: tempId,
                key_from_me: true,
                content: newMessage,
                timestamp: Date.now() / 1000,
                type: 'text',
                isPending: true // Flag importante
            };

            // Adiciona e mantém flag
            setMessages(prev => [...prev, tempMsg]);
            setNewMessage('');
            scrollToBottom();

            await fetch('/api/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contactId: selectedContact.id, content: tempMsg.content })
            });

            // SUCESSO: Remove o temporário antes de recarregar o real para evitar duplicata visual
            setMessages(prev => prev.filter(m => m.id !== tempId));

            // Recarrega para confirmar status/ID real
            await fetchMessages(selectedContact.id);
            fetchContacts();
        } catch (error) {
            console.error('Erro ao enviar', error);
            // Em caso de erro, talvez manter o pending ou avisar (simplesmente remove por enquanto)
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    React.useEffect(() => {
        fetchContacts();
        const interval = setInterval(fetchContacts, 10000); // Poll contatos a cada 10s
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (selectedContact) {
            fetchMessages(selectedContact.id);
            const interval = setInterval(() => fetchMessages(selectedContact.id), 3000); // Poll msgs a cada 3s
            return () => clearInterval(interval);
        }
    }, [selectedContact]);

    return (

        <div className="flex h-full gap-6 overflow-hidden">
            {/* Contact List */}
            <div className="w-80 flex flex-col gap-4 shrink-0">
                <div className="bg-white dark:bg-card-dark rounded-3xl p-4 shadow-xl border border-white/20">
                    <div className="relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar conversas..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-card-dark rounded-3xl shadow-xl border border-white/20 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Conversas</h3>
                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-lg">{contacts.length} Ativas</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => setSelectedContact(contact)}
                                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all mb-1 ${selectedContact?.id === contact.id ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl font-bold uppercase text-slate-500">
                                        {contact.profile_pic ? <img src={contact.profile_pic} className="w-full h-full rounded-xl object-cover" /> : contact.name?.charAt(0)}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className={`font-bold truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{contact.name || contact.remote_jid}</h4>
                                        <span className={`text-[10px] ${selectedContact?.id === contact.id ? 'text-white/70' : 'text-slate-400'}`}>
                                            {contact.lastTime ? new Date(contact.lastTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate ${selectedContact?.id === contact.id ? 'text-white/80' : 'text-slate-500'}`}>{contact.lastMessage}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white dark:bg-card-dark rounded-huge shadow-2xl border border-white/20 overflow-hidden relative">
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <span className="material-icons-round text-primary text-5xl">forum</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Selecione uma conversa</h2>
                        <p className="text-slate-500 max-w-xs">Escolha um contato ao lado para iniciar ou continuar o seu atendimento.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-card-dark/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                                    {selectedContact.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{selectedContact.name || selectedContact.remote_jid}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Online agora</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-4">
                            {messages.map((msg: any) => (
                                <div key={msg.id || msg.uid} className={`self-${msg.key_from_me ? 'end' : 'start'} max-w-[70%] ${msg.key_from_me ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'} p-4 rounded-2xl shadow-sm`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <span className={`text-[10px] mt-1 block ${msg.key_from_me ? 'text-white/70 text-right' : 'text-slate-400'}`}>
                                        {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-card-dark/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">add</span>
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                                        placeholder="Escreva sua mensagem..."
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                                    >
                                        <span className="material-icons-round text-sm">send</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatView;
