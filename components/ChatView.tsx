
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

// Som de notificação
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

// Função para formatar data amigável
const formatFriendlyDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) return daysOfWeek[date.getDay()];

    return date.toLocaleDateString('pt-BR');
};

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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showAIMenu, setShowAIMenu] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'chats' | 'blocked'>('chats');
    const [blockedContacts, setBlockedContacts] = useState<Contact[]>([]);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [agents, setAgents] = useState<{ id: number; name: string; email: string }[]>([]);
    const [messageSearch, setMessageSearch] = useState('');
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previousUnreadRef = useRef<number>(0);

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

    const fetchBlockedContacts = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/contacts/blocked', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBlockedContacts(data);
            }
        } catch (error) {
            console.error('Erro ao buscar bloqueados', error);
        }
    };

    // Marcar como lido ao selecionar contato
    const markAsRead = async (contactId: number) => {
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`/api/contacts/${contactId}/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c));
        } catch (error) {
            console.error('Erro ao marcar como lido', error);
        }
    };

    // Pesquisar mensagens
    const searchMessages = async () => {
        if (!selectedContact || !messageSearch.trim()) return;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/messages/${selectedContact.id}/search?q=${encodeURIComponent(messageSearch)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Erro na pesquisa', error);
        }
    };

    // Gravação de áudio
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Erro ao iniciar gravação:', err);
            alert('Não foi possível acessar o microfone.');
        }
    };

    const stopRecording = async (send: boolean) => {
        if (!mediaRecorderRef.current) return;

        return new Promise<void>((resolve) => {
            mediaRecorderRef.current!.onstop = async () => {
                if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
                setIsRecording(false);
                setRecordingTime(0);

                if (send && selectedContact && audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                            const token = localStorage.getItem('myzap_token');
                            await fetch('/api/messages/send-audio', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ contactId: selectedContact.id, audioBase64: base64 })
                            });
                            await fetchMessages(selectedContact.id);
                        } catch (err) {
                            console.error('Erro ao enviar áudio:', err);
                        }
                    };
                }

                // Parar todas as tracks
                mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
                resolve();
            };
            mediaRecorderRef.current!.stop();
        });
    };

    // Excluir Conversa
    const deleteConversation = async () => {
        if (!selectedContact) return;
        if (!window.confirm(`Tem certeza que deseja excluir a conversa com ${selectedContact.name || selectedContact.remote_jid}? Todas as mensagens serão removidas.`)) return;

        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/contacts/${selectedContact.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setSelectedContact(null);
                setMessages([]);
                fetchContacts();
                alert('Conversa excluída com sucesso!');
            } else {
                alert('Erro ao excluir conversa');
            }
        } catch (error) {
            console.error('Erro ao excluir conversa:', error);
            alert('Erro ao excluir conversa');
        }
    };

    // Bloquear/Desbloquear Contato
    const toggleBlockContact = async () => {
        if (!selectedContact) return;
        const isBlocked = (selectedContact as any).is_blocked;
        const action = isBlocked ? 'desbloquear' : 'bloquear';

        if (!window.confirm(`Tem certeza que deseja ${action} ${selectedContact.name || selectedContact.remote_jid}?`)) return;

        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/contacts/${selectedContact.id}/block`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ block: !isBlocked })
            });
            if (res.ok) {
                fetchContacts();
                alert(`Contato ${isBlocked ? 'desbloqueado' : 'bloqueado'} com sucesso!`);
            } else {
                alert(`Erro ao ${action} contato`);
            }
        } catch (error) {
            console.error(`Erro ao ${action} contato:`, error);
            alert(`Erro ao ${action} contato`);
        }
    };
    const improveTextWithAI = async (tone: string) => {
        if (!newMessage.trim()) return;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text: newMessage, tone })
            });
            const data = await res.json();
            if (data.error) {
                if (data.code === 'AI_NOT_CONFIGURED') {
                    alert('Configure sua API Key do Gemini em Integrações de IA.');
                } else {
                    alert(data.message || data.error);
                }
            } else {
                setNewMessage(data.improved);
            }
        } catch (err) {
            console.error('Erro IA:', err);
        }
        setShowAIMenu(false);
    };

    // Encaminhamento
    const fetchAgents = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/admin/agents', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setAgents(await res.json());
        } catch (err) {
            console.error('Erro ao buscar atendentes:', err);
        }
    };

    const transferConversation = async (targetUserId: number) => {
        if (!selectedContact) return;
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`/api/contacts/${selectedContact.id}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ target_user_id: targetUserId })
            });
            setShowTransferModal(false);
            setSelectedContact(null);
            fetchContacts();
            alert('Conversa transferida com sucesso!');
        } catch (err) {
            console.error('Erro ao transferir:', err);
        }
    };

    // Notificação sonora
    const playNotificationSound = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(NOTIFICATION_SOUND);
            audioRef.current.volume = 0.5;
        }
        audioRef.current.play().catch(() => { });
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

    const getStatusIcon = (status?: string | number) => {
        // Garantir que status seja string para o switch
        const s = String(status || '').toLowerCase();
        switch (s) {
            case 'read': case '4': case 'visto':
                return <span className="material-icons-round text-blue-400 text-[14px]">done_all</span>;
            case 'delivered': case '3': case 'entregue':
                return <span className="material-icons-round text-slate-400 text-[14px]">done_all</span>;
            case 'sent': case '2': case 'enviado':
                return <span className="material-icons-round text-slate-400 text-[14px]">done</span>;
            default:
                // Se for nulo ou vazio não mostra nada pra não poluir
                if (!status) return null;
                return <span className="material-icons-round text-slate-400 text-[14px]">done</span>;
        }
    };

    const renderMessageContent = (msg: Message) => {
        let content = msg.content;
        let type = msg.type;
        let mediaUrl = msg.media_url;

        // Fallback: Se o conteúdo for um JSON de mídia (mensagens antigas ou erro de parse no webhook)
        if (content && content.startsWith('{') && content.endsWith('}')) {
            try {
                const parsed = JSON.parse(content);
                if (parsed.imageMessage) { type = 'image'; mediaUrl = parsed.imageMessage.url; content = parsed.imageMessage.caption || ''; }
                else if (parsed.videoMessage) { type = 'video'; mediaUrl = parsed.videoMessage.url; content = parsed.videoMessage.caption || ''; }
                else if (parsed.audioMessage) { type = 'audio'; mediaUrl = parsed.audioMessage.url; content = ''; }
                else if (parsed.documentMessage) { type = 'document'; mediaUrl = parsed.documentMessage.url; content = parsed.documentMessage.title || ''; }
            } catch (e) { /* ignore */ }
        }

        if (type === 'image' && mediaUrl) {
            return (
                <div className="flex flex-col">
                    <img src={mediaUrl} alt="Imagem" className="max-w-full rounded-lg mb-1 shadow-sm cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(mediaUrl, '_blank')} />
                    {content && <p className="text-sm">{content}</p>}
                </div>
            );
        }
        if (type === 'video' && mediaUrl) {
            return (
                <div className="flex flex-col">
                    <video src={mediaUrl} controls className="max-w-full rounded-lg mb-1 shadow-sm" />
                    {content && <p className="text-sm">{content}</p>}
                </div>
            );
        }
        if (type === 'audio' && mediaUrl) {
            return <audio src={mediaUrl} controls className="w-full h-8 mt-1" />;
        }
        if (type === 'document' && mediaUrl) {
            return (
                <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl text-sm hover:bg-black/10 transition-colors">
                    <span className="material-icons-round text-2xl">description</span>
                    <span className="flex-1 truncate font-medium">{content || 'Documento'}</span>
                    <span className="material-icons-round text-xs">download</span>
                </a>
            );
        }
        return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
    };

    useEffect(() => {
        fetchContacts();
        fetchBlockedContacts();
        const interval = setInterval(() => {
            fetchContacts();
            fetchBlockedContacts();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedContact) {
            markAsRead(selectedContact.id);
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
                    <div className="p-0 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex">
                            <button
                                onClick={() => setActiveSidebarTab('chats')}
                                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeSidebarTab === 'chats' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                Conversas
                            </button>
                            <button
                                onClick={() => setActiveSidebarTab('blocked')}
                                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeSidebarTab === 'blocked' ? 'border-rose-500 text-rose-500 bg-rose-50' : 'border-transparent text-slate-400 hover:text-rose-400'}`}
                            >
                                Bloqueados
                            </button>
                        </div>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        {!sidebarCollapsed && <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{activeSidebarTab === 'chats' ? 'Recentes' : 'Contatos Bloqueados'}</h3>}
                        <div className="flex items-center gap-2">
                            <span className={`${activeSidebarTab === 'chats' ? 'bg-primary/10 text-primary' : 'bg-rose-100 text-rose-500'} text-xs font-bold px-2 py-1 rounded-lg`}>
                                {activeSidebarTab === 'chats' ? filteredContacts.length : blockedContacts.length}
                            </span>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="hidden lg:flex w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-slate-400 text-sm">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {(activeSidebarTab === 'chats' ? filteredContacts : blockedContacts).map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => { setSelectedContact(contact); setShowContactDetails(false); }}
                                className={`flex items-center gap-3 ${sidebarCollapsed ? 'p-1 justify-center' : 'p-3'} rounded-2xl cursor-pointer transition-all mb-1 ${selectedContact?.id === contact.id ? 'bg-primary text-white scale-[1.02] shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                <div className={`relative ${sidebarCollapsed ? 'mx-auto' : ''}`}>
                                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl font-bold uppercase text-slate-500 overflow-hidden shadow-inner">
                                        {contact.profile_pic ? <img src={contact.profile_pic} className="w-full h-full object-cover" /> : contact.name?.charAt(0)}
                                    </div>
                                    {/* Status Indicator */}
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${contact.status === 'open' ? 'bg-emerald-500' : contact.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                                    {/* Unread Badge */}
                                    {(contact.unread_count || 0) > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md">
                                            {contact.unread_count! > 99 ? '99+' : contact.unread_count}
                                        </div>
                                    )}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className={`font-bold truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{contact.name || contact.remote_jid}</h4>
                                            <div className="flex items-center gap-1">
                                                {(contact.unread_count || 0) > 0 && !sidebarCollapsed && (
                                                    <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                                        {contact.unread_count! > 99 ? '99+' : contact.unread_count}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] ${selectedContact?.id === contact.id ? 'text-white/70' : 'text-slate-400'}`}>
                                                    {contact.lastTime ? formatFriendlyDate(contact.lastTime) : ''}
                                                </span>
                                            </div>
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
                                {/* Search Messages */}
                                <button onClick={() => setShowMessageSearch(!showMessageSearch)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showMessageSearch ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`} title="Pesquisar mensagens">
                                    <span className="material-icons-round text-sm">search</span>
                                </button>
                                {/* Transfer */}
                                <button onClick={() => { fetchAgents(); setShowTransferModal(true); }} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-violet-100 hover:text-violet-500 flex items-center justify-center transition-all" title="Encaminhar conversa">
                                    <span className="material-icons-round text-sm">forward_to_inbox</span>
                                </button>
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
                                {/* Block & Delete Buttons */}
                                <button
                                    onClick={toggleBlockContact}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${(selectedContact as any).is_blocked ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-100 hover:text-rose-500'}`}
                                    title={(selectedContact as any).is_blocked ? 'Desbloquear Contato' : 'Bloquear Contato'}
                                >
                                    <span className="material-icons-round text-sm">{(selectedContact as any).is_blocked ? 'lock_open' : 'block'}</span>
                                </button>
                                <button
                                    onClick={deleteConversation}
                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-100 hover:text-rose-500 flex items-center justify-center transition-all"
                                    title="Excluir Conversa"
                                >
                                    <span className="material-icons-round text-sm">delete_outline</span>
                                </button>
                                {/* Contact Details Toggle */}
                                <button onClick={() => setShowContactDetails(!showContactDetails)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">person</span>
                                </button>
                            </div>
                        </div>

                        {/* Message Search Bar */}
                        {showMessageSearch && (
                            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={messageSearch}
                                    onChange={(e) => setMessageSearch(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') searchMessages(); }}
                                    placeholder="Pesquisar nesta conversa..."
                                    className="flex-1 bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-sm border-none focus:ring-2 focus:ring-primary outline-none"
                                />
                                <button onClick={searchMessages} className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                                    <span className="material-icons-round text-sm">search</span>
                                </button>
                                <button onClick={() => { setShowMessageSearch(false); setMessageSearch(''); if (selectedContact) fetchMessages(selectedContact.id); }} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 flex items-center justify-center">
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>
                        )}

                        {/* Transfer Modal */}
                        {showTransferModal && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-96 shadow-2xl">
                                    <h3 className="text-lg font-bold mb-4 dark:text-white">Encaminhar conversa</h3>
                                    {agents.length === 0 ? (
                                        <p className="text-slate-500 text-sm">Nenhum outro atendente disponível.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {agents.map(agent => (
                                                <button
                                                    key={agent.id}
                                                    onClick={() => transferConversation(agent.id)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {agent.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium dark:text-white">{agent.name}</p>
                                                        <p className="text-xs text-slate-500">{agent.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowTransferModal(false)}
                                        className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm font-medium dark:text-white"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

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
                                                    {!!msg.key_from_me && getStatusIcon(msg.status)}
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

                            {/* AI Menu */}
                            {showAIMenu && (
                                <div className="absolute bottom-full right-4 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 min-w-[200px]">
                                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Melhorar com IA</p>
                                    <div className="flex flex-col gap-1">
                                        {[
                                            { key: 'profissional', label: 'Profissional', icon: 'business' },
                                            { key: 'educado', label: 'Educado', icon: 'emoji_emotions' },
                                            { key: 'serio', label: 'Sério', icon: 'sentiment_neutral' },
                                            { key: 'engracado', label: 'Engraçado', icon: 'mood' },
                                            { key: 'bravo', label: 'Firme', icon: 'priority_high' },
                                            { key: 'ortografia', label: 'Corrigir ortografia', icon: 'spellcheck' }
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => improveTextWithAI(opt.key)}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-left transition-all"
                                            >
                                                <span className="material-icons-round text-primary text-sm">{opt.icon}</span>
                                                <span className="dark:text-white">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); setShowAIMenu(false); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">add</span>
                                </button>
                                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); setShowAIMenu(false); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">sentiment_satisfied</span>
                                </button>
                                {/* AI Button */}
                                <button onClick={() => { setShowAIMenu(!showAIMenu); setShowEmojiPicker(false); setShowAttachMenu(false); }} className={`w-10 h-10 rounded-full ${showAIMenu ? 'bg-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-violet-500'} transition-all flex items-center justify-center`} title="Assistente IA">
                                    <span className="material-icons-round">auto_awesome</span>
                                </button>

                                {/* Input or Recording or Blocked Alert */}
                                {(selectedContact as any).is_blocked ? (
                                    <div className="flex-1 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-3 flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                            <span className="material-icons-round text-sm">block</span>
                                            <span className="text-sm font-bold">Contato Bloqueado</span>
                                        </div>
                                        <p className="text-[10px] text-rose-500/70">As mensagens deste contato serão ignoradas pelo sistema.</p>
                                    </div>
                                ) : isRecording ? (
                                    <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/30 rounded-2xl py-3 px-4">
                                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                                        <span className="text-red-600 dark:text-red-400 font-medium">
                                            {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                                        </span>
                                        <div className="flex-1"></div>
                                        <button onClick={() => stopRecording(false)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 flex items-center justify-center hover:bg-slate-300">
                                            <span className="material-icons-round text-sm">delete</span>
                                        </button>
                                        <button onClick={() => stopRecording(true)} className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-110 transition-all">
                                            <span className="material-icons-round text-sm">send</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                                                onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); setShowAIMenu(false); }}
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
                                        {/* Mic Button */}
                                        <button onClick={startRecording} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center" title="Gravar áudio">
                                            <span className="material-icons-round">mic</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatView;
