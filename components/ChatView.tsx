
import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface Contact {
    id: number;
    name: string;
    remote_jid: string;
    profile_pic?: string;
    lastMessage?: string;
    lastTime?: number;
    status?: 'open' | 'pending' | 'closed';
    unread_count?: number;
}

interface Message {
    id: number;
    uid?: string;
    content: string;
    type: string;
    key_from_me: boolean;
    timestamp: number;
    source?: string;
    status?: 'sent' | 'delivered' | 'read';
    media_url?: string;
    isPending?: boolean;
}

const ChatView: React.FC = () => {
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'closed'>('all');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showContactDetails, setShowContactDetails] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregar Contatos
    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/contacts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Add default status if not present
                const enriched = data.map((c: any) => ({
                    ...c,
                    status: c.status || 'open'
                }));
                setContacts(enriched);
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
                setMessages(prev => {
                    const pending = prev.filter(m => m.isPending);
                    return [...data, ...pending];
                });
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
            const tempMsg: Message = {
                id: tempId,
                key_from_me: true,
                content: newMessage,
                timestamp: Date.now() / 1000,
                type: 'text',
                status: 'sent',
                isPending: true
            };

            setMessages(prev => [...prev, tempMsg]);
            setNewMessage('');
            setShowEmojiPicker(false);
            scrollToBottom();

            await fetch('/api/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contactId: selectedContact.id, content: tempMsg.content })
            });

            setMessages(prev => prev.filter(m => m.id !== tempId));
            await fetchMessages(selectedContact.id);
            fetchContacts();
        } catch (error) {
            console.error('Erro ao enviar', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleSendFile = async (file: File) => {
        if (!selectedContact) return;

        const tempId = Date.now();
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');

        try {
            const token = localStorage.getItem('myzap_token');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('contactId', selectedContact.id.toString());

            const tempMsg: Message = {
                id: tempId,
                key_from_me: true,
                content: `📎 ${file.name}`,
                timestamp: Date.now() / 1000,
                type: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document',
                status: 'sent',
                isPending: true,
                media_url: URL.createObjectURL(file)
            };

            setMessages(prev => [...prev, tempMsg]);
            setShowAttachMenu(false);
            scrollToBottom();

            await fetch('/api/messages/send-media', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            setMessages(prev => prev.filter(m => m.id !== tempId));
            await fetchMessages(selectedContact.id);
            fetchContacts();
        } catch (error) {
            console.error('Erro ao enviar arquivo', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleSendFile(file);
    };

    const updateContactStatus = async (contactId: number, status: 'open' | 'pending' | 'closed') => {
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`/api/contacts/${contactId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status } : c));
        } catch (error) {
            console.error('Erro ao atualizar status', error);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const filteredContacts = contacts.filter(c => {
        const matchesSearch = (c.name || c.remote_jid).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'read': return <span className="material-icons-round text-blue-400 text-xs">done_all</span>;
            case 'delivered': return <span className="material-icons-round text-slate-400 text-xs">done_all</span>;
            default: return <span className="material-icons-round text-slate-400 text-xs">done</span>;
        }
    };

    const renderMessageContent = (msg: Message) => {
        if (msg.type === 'image' && msg.media_url) {
            return (
                <div>
                    <img src={msg.media_url} alt="Imagem" className="max-w-full rounded-lg mb-2" />
                    {msg.content && <p className="text-sm">{msg.content}</p>}
                </div>
            );
        }
        if (msg.type === 'video' && msg.media_url) {
            return (
                <div>
                    <video src={msg.media_url} controls className="max-w-full rounded-lg mb-2" />
                    {msg.content && <p className="text-sm">{msg.content}</p>}
                </div>
            );
        }
        if (msg.type === 'audio' && msg.media_url) {
            return <audio src={msg.media_url} controls className="w-full" />;
        }
        if (msg.type === 'document' && msg.media_url) {
            return (
                <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                    <span className="material-icons-round">description</span>
                    {msg.content || 'Documento'}
                </a>
            );
        }
        return <p className="text-sm whitespace-pre-wrap">{msg.content}</p>;
    };

    useEffect(() => {
        fetchContacts();
        const interval = setInterval(fetchContacts, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedContact) {
            fetchMessages(selectedContact.id);
            const interval = setInterval(() => fetchMessages(selectedContact.id), 3000);
            return () => clearInterval(interval);
        }
    }, [selectedContact]);

    return (
        <div className="flex h-full gap-4 overflow-hidden">
            {/* Sidebar Toggle (Mobile) */}
            <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute left-4 top-4 z-50 lg:hidden w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center"
            >
                <span className="material-icons-round">{sidebarCollapsed ? 'menu' : 'close'}</span>
            </button>

            {/* Contact List Sidebar */}
            <div className={`${sidebarCollapsed ? 'hidden lg:flex' : 'flex'} ${sidebarCollapsed ? 'lg:w-20' : 'w-80'} flex-col gap-4 shrink-0 transition-all duration-300`}>
                {/* Search */}
                {!sidebarCollapsed && (
                    <div className="bg-white dark:bg-card-dark rounded-3xl p-4 shadow-xl border border-white/20">
                        <div className="relative mb-3">
                            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar conversas..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                            />
                        </div>
                        {/* Filters */}
                        <div className="flex gap-2">
                            {(['all', 'open', 'pending', 'closed'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterStatus === status ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {status === 'all' ? 'Todas' : status === 'open' ? 'Abertas' : status === 'pending' ? 'Pendentes' : 'Fechadas'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Contacts List */}
                <div className="flex-1 bg-white dark:bg-card-dark rounded-3xl shadow-xl border border-white/20 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        {!sidebarCollapsed && <h3 className="font-bold text-slate-800 dark:text-slate-100">Conversas</h3>}
                        <div className="flex items-center gap-2">
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-lg">{filteredContacts.length}</span>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="hidden lg:flex w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-slate-400 text-sm">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {filteredContacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => { setSelectedContact(contact); setShowContactDetails(false); }}
                                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all mb-1 ${selectedContact?.id === contact.id ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl font-bold uppercase text-slate-500">
                                        {contact.profile_pic ? <img src={contact.profile_pic} className="w-full h-full rounded-xl object-cover" /> : contact.name?.charAt(0)}
                                    </div>
                                    {/* Status Indicator */}
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${contact.status === 'open' ? 'bg-emerald-500' : contact.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className={`font-bold truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{contact.name || contact.remote_jid}</h4>
                                            <span className={`text-[10px] ${selectedContact?.id === contact.id ? 'text-white/70' : 'text-slate-400'}`}>
                                                {contact.lastTime ? new Date(contact.lastTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate ${selectedContact?.id === contact.id ? 'text-white/80' : 'text-slate-500'}`}>{contact.lastMessage}</p>
                                    </div>
                                )}
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
                                    {selectedContact.profile_pic ? <img src={selectedContact.profile_pic} className="w-full h-full rounded-xl object-cover" /> : selectedContact.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{selectedContact.name || selectedContact.remote_jid}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${selectedContact.status === 'open' ? 'bg-emerald-500' : selectedContact.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                            {selectedContact.status === 'open' ? 'Aberto' : selectedContact.status === 'pending' ? 'Pendente' : 'Fechado'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Status Buttons */}
                                <div className="flex gap-1 mr-2">
                                    <button onClick={() => updateContactStatus(selectedContact.id, 'open')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedContact.status === 'open' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-emerald-100'}`} title="Marcar como Aberto">
                                        <span className="material-icons-round text-sm">mark_chat_read</span>
                                    </button>
                                    <button onClick={() => updateContactStatus(selectedContact.id, 'pending')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedContact.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-amber-100'}`} title="Marcar como Pendente">
                                        <span className="material-icons-round text-sm">schedule</span>
                                    </button>
                                    <button onClick={() => updateContactStatus(selectedContact.id, 'closed')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedContact.status === 'closed' ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`} title="Marcar como Fechado">
                                        <span className="material-icons-round text-sm">check_circle</span>
                                    </button>
                                </div>
                                {/* Contact Details Toggle */}
                                <button onClick={() => setShowContactDetails(!showContactDetails)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">person</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-3">
                                {messages.map((msg) => (
                                    <div key={msg.id || msg.uid} className={`flex ${msg.key_from_me ? 'justify-end' : 'justify-start'}`}>
                                        <div className="max-w-[70%]">
                                            {msg.source === 'flow' && (
                                                <div className="flex items-center gap-1 mb-1 justify-end">
                                                    <span className="material-icons-round text-xs text-violet-500">smart_toy</span>
                                                    <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">Bot</span>
                                                </div>
                                            )}
                                            <div className={`${msg.key_from_me ? (msg.source === 'flow' ? 'bg-violet-500' : 'bg-primary') + ' text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'} p-4 rounded-2xl shadow-sm`}>
                                                {renderMessageContent(msg)}
                                                <div className={`flex items-center gap-1 mt-1 ${msg.key_from_me ? 'justify-end' : ''}`}>
                                                    <span className={`text-[10px] ${msg.key_from_me ? 'text-white/70' : 'text-slate-400'}`}>
                                                        {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {msg.key_from_me && getStatusIcon(msg.status)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Contact Details Panel */}
                            {showContactDetails && (
                                <div className="w-80 border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-card-dark p-6 overflow-y-auto">
                                    <div className="text-center mb-6">
                                        <div className="w-24 h-24 rounded-2xl bg-slate-200 mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-slate-500">
                                            {selectedContact.profile_pic ? <img src={selectedContact.profile_pic} className="w-full h-full rounded-2xl object-cover" /> : selectedContact.name?.charAt(0)}
                                        </div>
                                        <h3 className="text-xl font-bold dark:text-white">{selectedContact.name || 'Sem nome'}</h3>
                                        <p className="text-sm text-slate-500">{selectedContact.remote_jid}</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Informações</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Telefone</span>
                                                    <span className="font-medium dark:text-white">{selectedContact.remote_jid?.replace('@s.whatsapp.net', '')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Status</span>
                                                    <span className={`font-medium ${selectedContact.status === 'open' ? 'text-emerald-500' : selectedContact.status === 'pending' ? 'text-amber-500' : 'text-slate-500'}`}>
                                                        {selectedContact.status === 'open' ? 'Aberto' : selectedContact.status === 'pending' ? 'Pendente' : 'Fechado'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Mensagens</span>
                                                    <span className="font-medium dark:text-white">{messages.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-card-dark/50 backdrop-blur-md relative">
                            {/* Emoji Picker */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-full left-4 mb-2 z-50">
                                    <EmojiPicker onEmojiClick={handleEmojiClick} width={350} height={400} />
                                </div>
                            )}

                            {/* Attach Menu */}
                            {showAttachMenu && (
                                <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50">
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => { fileInputRef.current?.click(); }} className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                                            <span className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                                                <span className="material-icons-round">image</span>
                                            </span>
                                            <span className="font-medium dark:text-white">Imagem</span>
                                        </button>
                                        <button onClick={() => { fileInputRef.current?.click(); }} className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                                            <span className="w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center">
                                                <span className="material-icons-round">description</span>
                                            </span>
                                            <span className="font-medium dark:text-white">Documento</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                                onChange={handleFileSelect}
                            />

                            <div className="flex items-center gap-3">
                                <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">add</span>
                                </button>
                                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">sentiment_satisfied</span>
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                                        onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }}
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
