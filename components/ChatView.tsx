import React, { useState, useRef, useEffect, useMemo } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

// --- Interfaces ---
interface Contact {
    id: number;
    name: string;
    remote_jid: string;
    profile_pic?: string;
    lastMessage?: string;
    lastTime?: number;
    status?: 'open' | 'pending' | 'closed';
    unread_count?: number;
    is_blocked?: boolean;
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

const API_URL = '/api';
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

// --- Utility Functions ---
const formatFriendlyDate = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) return daysOfWeek[date.getDay()];

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const ChatView: React.FC = () => {
    // --- State Management ---
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'closed'>('all');
    const [activeTab, setActiveTab] = useState<'chats' | 'blocked'>('chats');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [transferModal, setTransferModal] = useState(false);
    const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageRef = useRef<string | null>(null);

    // --- Fetching Data ---
    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/contacts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data.map((c: any) => ({ ...c, status: c.status || 'open' })));
            }
        } catch (error) {
            console.error('Erro ao buscar contatos:', error);
        }
    };

    const fetchMessages = async (contactId: number) => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/messages/${contactId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(prev => {
                    // Filter out pending messages that already exist in the server data
                    const pending = prev.filter(m => m.isPending && !data.some((dm: any) => dm.uid === m.uid || (dm.content === m.content && Math.abs(dm.timestamp - m.timestamp) < 5)));
                    const newMessages = [...data, ...pending];
                    // Play notification if new message received
                    if (data.length > 0) {
                        const lastMsg = data[data.length - 1];
                        if (!lastMsg.key_from_me && lastMsg.uid !== lastMessageRef.current) {
                            lastMessageRef.current = lastMsg.uid;
                            new Audio(NOTIFICATION_SOUND).play().catch(() => { });
                        }
                    }
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
        }
    };

    const markAsRead = async (contactId: number) => {
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`${API_URL}/contacts/${contactId}/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c));
        } catch (err) { }
    };

    const updateStatus = async (contactId: number, status: 'open' | 'pending' | 'closed') => {
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`${API_URL}/contacts/${contactId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status } : c));
            if (selectedContact?.id === contactId) {
                setSelectedContact(prev => prev ? { ...prev, status } : null);
            }
        } catch (err) { }
    };

    const fetchAgents = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/admin/agents', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setAgents(await res.json());
        } catch (err) { }
    };

    const transferConversation = async (targetUserId: number) => {
        if (!selectedContact) return;
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`/api/contacts/${selectedContact.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ target_user_id: targetUserId })
            });
            setTransferModal(false);
            setSelectedContact(null);
            fetchContacts();
            alert('Conversa transferida com sucesso!');
        } catch (err) { }
    };

    // --- Audio Logic ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) mimeType = 'audio/ogg; codecs=opus';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            alert('Não foi possível acessar o microfone.');
        }
    };

    const stopRecording = async (shouldSend: boolean) => {
        if (!mediaRecorderRef.current) return;

        if (timerRef.current) clearInterval(timerRef.current);
        const recorder = mediaRecorderRef.current;
        setIsRecording(false);

        recorder.onstop = async () => {
            if (shouldSend && selectedContact && audioChunksRef.current.length > 0) {
                const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    const tempId = Date.now();
                    // Add pending audio message
                    setMessages(prev => [...prev, { id: tempId, content: 'Áudio', type: 'audio', key_from_me: true, timestamp: Date.now() / 1000, isPending: true }]);

                    try {
                        const token = localStorage.getItem('myzap_token');
                        const res = await fetch(`${API_URL}/messages/send-audio`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ contactId: selectedContact.id, audioBase64: base64 })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, uid: data.messageId, media_url: data.audioUrl, isPending: false } : m));
                            fetchMessages(selectedContact.id);
                        } else {
                            setMessages(prev => prev.filter(m => m.id !== tempId));
                            alert('Erro ao enviar áudio: ' + (data.error || 'Erro desconhecido'));
                        }
                    } catch (err) {
                        console.error('Erro ao enviar áudio:', err);
                        setMessages(prev => prev.filter(m => m.id !== tempId));
                    }
                };
            }
            recorder.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        };
        recorder.stop();
    };

    // --- Handlers ---
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedContact) return;
        const msg = newMessage;
        setNewMessage('');
        setShowEmojiPicker(false);
        const tempId = Date.now();
        setMessages(prev => [...prev, { id: tempId, content: msg, type: 'text', key_from_me: true, timestamp: Date.now() / 1000, isPending: true }]);

        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ contactId: selectedContact.id, content: msg })
            });
            const data = await res.json();
            if (res.ok) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, uid: data.key?.id || data.id, isPending: false } : m));
                fetchMessages(selectedContact.id);
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedContact) return;

        const tempId = Date.now();
        const mimeType = file.mimetype || file.type;
        let mediaType = 'document';
        if (mimeType.startsWith('image/')) mediaType = 'image';
        else if (mimeType.startsWith('video/')) mediaType = 'video';
        else if (mimeType.startsWith('audio/')) mediaType = 'audio';

        // Add pending message with local preview if possible
        const localUrl = URL.createObjectURL(file);
        setMessages(prev => [...prev, {
            id: tempId,
            content: file.name,
            type: mediaType,
            key_from_me: true,
            timestamp: Date.now() / 1000,
            isPending: true,
            media_url: localUrl
        }]);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('contactId', selectedContact.id.toString());

        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/messages/send-media`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, uid: data.messageId, media_url: data.mediaUrl, isPending: false } : m));
                fetchMessages(selectedContact.id);
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
                alert('Erro ao enviar arquivo: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (err) {
            console.error('Erro ao enviar mídia:', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleBlock = async () => {
        if (!selectedContact) return;
        const block = !selectedContact.is_blocked;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/contacts/${selectedContact.id}/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ block })
            });
            if (res.ok) {
                setSelectedContact(prev => prev ? { ...prev, is_blocked: block } : null);
                fetchContacts();
            }
        } catch (err) { }
    };

    const deleteConversation = async () => {
        if (!selectedContact || !window.confirm('Excluir toda a conversa?')) return;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/contacts/${selectedContact.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setSelectedContact(null);
                fetchContacts();
            }
        } catch (err) { }
    };

    const improveText = async (tone: string) => {
        if (!newMessage.trim()) return;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: newMessage, tone })
            });
            const data = await res.json();
            if (data.improved) setNewMessage(data.improved);
        } catch (err) { }
    };

    // --- Computed ---
    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesSearch = (c.name || c.remote_jid).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = activeTab === 'chats' ? !c.is_blocked : c.is_blocked;
            const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
            return matchesSearch && matchesTab && matchesFilter;
        }).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
    }, [contacts, searchTerm, activeTab, filterStatus]);

    // --- Effects ---
    useEffect(() => {
        fetchContacts();
        const interval = setInterval(fetchContacts, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedContact) {
            fetchMessages(selectedContact.id);
            markAsRead(selectedContact.id);
            const interval = setInterval(() => fetchMessages(selectedContact.id), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedContact]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Render Helpers ---
    const getMessageContent = (msg: Message) => {
        let content = msg.content;
        let type = msg.type;
        let mediaUrl = msg.media_url;

        // Recursive helper to find media in Evolution JSON
        const findMedia = (obj: any): { type: string; msg: any } | null => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.imageMessage) return { type: 'image', msg: obj.imageMessage };
            if (obj.audioMessage) return { type: 'audio', msg: obj.audioMessage };
            if (obj.videoMessage) return { type: 'video', msg: obj.videoMessage };
            if (obj.documentMessage) return { type: 'document', msg: obj.documentMessage };

            for (const key in obj) {
                const found = findMedia(obj[key]);
                if (found) return found;
            }
            return null;
        };

        // Smart parser for Evolution JSON messages
        if (content && (content.startsWith('{') || content.includes('"message"') || content.includes('"key"'))) {
            try {
                const jsonMatch = content.match(/\{.*\}/s);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const media = findMedia(data.message || data);
                    if (media) {
                        type = media.type;
                        mediaUrl = media.msg.url || media.msg.directPath || mediaUrl;
                        content = media.msg.caption || media.msg.title || media.msg.fileName || '';
                    }
                }
            } catch (e) { }
        }

        // Apply media proxy if needed
        if (mediaUrl && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
            const settings = JSON.parse(localStorage.getItem('myzap_settings') || '{}');
            const baseUrl = settings.app_url || window.location.origin;
            const currentOrigin = window.location.origin;

            // Handle localhost replacement if strictly different from current origin
            if (mediaUrl.includes('localhost') && !currentOrigin.includes('localhost')) {
                mediaUrl = mediaUrl.replace(/https?:\/\/localhost(:\d+)?/, currentOrigin.replace(/\/$/, ''));
            }

            if (!mediaUrl.startsWith('http')) {
                // Handle both filename-only and relative paths
                const path = mediaUrl.startsWith('/') ? mediaUrl : `/api/uploads/${mediaUrl}`;
                mediaUrl = `${baseUrl.replace(/\/$/, '')}${path}`;
            }
        }

        // WhatsApp Media Proxy Logic
        if (mediaUrl && (mediaUrl.includes('whatsapp.net') || mediaUrl.includes('.enc') || mediaUrl.includes('mmg.whatsapp.net') || mediaUrl.startsWith('/mms/'))) {
            let fullUrl = mediaUrl;
            if (mediaUrl.startsWith('/mms/')) {
                fullUrl = `https://mmg.whatsapp.net${mediaUrl}`;
            }
            mediaUrl = `/api/media/proxy?url=${encodeURIComponent(fullUrl)}`;
        }

        return { content, type, mediaUrl };
    };

    const renderMessage = (msg: Message) => {
        const isMe = msg.key_from_me;
        const { content, type, mediaUrl } = getMessageContent(msg);

        return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`
                    max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] p-3 rounded-2xl shadow-sm relative
                    ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'}
                `}>
                    {type === 'image' && mediaUrl && (
                        <div className="relative group">
                            <img src={mediaUrl} className="rounded-xl mb-2 max-h-80 w-full object-contain bg-black/5 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(mediaUrl, '_blank')} />
                        </div>
                    )}
                    {type === 'video' && mediaUrl && (
                        <video src={mediaUrl} controls className="rounded-xl mb-2 max-h-80 w-full bg-black/5" />
                    )}
                    {type === 'audio' && mediaUrl && (
                        <div className="min-w-[240px] py-2 px-1">
                            <audio
                                src={mediaUrl}
                                controls
                                preload="metadata"
                                className={`w-full h-8 ${isMe ? 'filter invert brightness-200 contrast-100' : ''}`}
                                onError={(e) => console.error('[AUDIO] Erro ao carregar:', mediaUrl)}
                            />
                            <div className="flex justify-between mt-1 text-[9px] uppercase font-bold opacity-50">
                                <span>Mensagem de Voz</span>
                            </div>
                        </div>
                    )}
                    {type === 'document' && mediaUrl && (
                        <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 mb-2 group">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-icons-round">description</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs truncate font-bold">{content || 'Arquivo'}</p>
                                <p className="text-[9px] opacity-50">DOCUMENTO</p>
                            </div>
                            <a href={mediaUrl} target="_blank" className="p-2 hover:bg-black/5 rounded-lg transition-all"><span className="material-icons-round text-sm">download</span></a>
                        </div>
                    )}
                    {type === 'text' && content && <p className="text-[14px] whitespace-pre-wrap leading-relaxed py-0.5">{content}</p>}

                    <div className={`flex items-center justify-end gap-1 mt-1 opacity-60`}>
                        <span className="text-[9px] uppercase font-bold tracking-tighter">
                            {new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && !msg.isPending && (
                            <span className="material-icons-round text-[14px] ml-0.5">
                                {msg.status === 'read' ? 'done_all' : msg.status === 'delivered' ? 'done_all' : 'done'}
                            </span>
                        )}
                        {msg.isPending && <span className="material-icons-round text-[12px] animate-spin ml-0.5">sync</span>}
                    </div>
                </div>
            </div>
        );
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'open': return 'bg-emerald-500';
            case 'pending': return 'bg-amber-500';
            case 'closed': return 'bg-slate-400';
            default: return 'bg-slate-400';
        }
    };

    return (
        <div className="flex h-full bg-[#F0F2F5] dark:bg-slate-950 overflow-hidden font-sans">
            {/* Sidebar Toggle Overlay (Mobile) */}
            {!isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(true)}
                ></div>
            )}

            {/* --- Sidebar (Contact List) --- */}
            <div className={`
                fixed inset-y-0 left-0 z-30 w-full sm:w-[380px] lg:static lg:z-0
                bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
                flex flex-col transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 bg-[#F0F2F5] dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg transform -rotate-6">
                            MZ
                        </div>
                        <h1 className="font-black text-slate-800 dark:text-slate-100 italic tracking-tight text-xl">MyZap</h1>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="relative group">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Procurar conversas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-[#F0F2F5] dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-primary text-sm transition-all outline-none shadow-inner"
                        />
                    </div>

                    <div className="flex gap-1 p-1.5 bg-[#F0F2F5] dark:bg-slate-800 rounded-2xl">
                        {(['all', 'open', 'pending', 'closed'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`
                                    flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all
                                    ${filterStatus === s
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm scale-[1.05]'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}
                                `}
                            >
                                {s === 'all' ? 'Tudo' : s === 'open' ? 'Aberto' : s === 'pending' ? 'Pendente' : 'Fim'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 opacity-30 select-none">
                            <span className="material-icons-round text-6xl mb-4">history</span>
                            <p className="text-sm font-bold uppercase tracking-widest text-center">Nenhuma conversa encontrada</p>
                        </div>
                    ) : (
                        filteredContacts.map(contact => (
                            <div
                                key={contact.id}
                                onClick={() => {
                                    setSelectedContact(contact);
                                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                }}
                                className={`
                                    flex items-center gap-4 p-4 cursor-pointer transition-all rounded-[1.75rem] mb-1 relative border border-transparent
                                    ${selectedContact?.id === contact.id
                                        ? 'bg-white dark:bg-slate-800 shadow-xl border-slate-100 dark:border-slate-700 scale-[0.98]'
                                        : 'hover:bg-white/50 dark:hover:bg-slate-800/30'}
                                `}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-black text-2xl shadow-inner border-2 border-white dark:border-slate-900">
                                        {contact.profile_pic ? (
                                            <img src={contact.profile_pic} alt={contact.name} className="w-full h-full object-cover" />
                                        ) : (contact.name || contact.remote_jid).charAt(0)}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 shadow-md ${getStatusColor(contact.status)}`}></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-[15px]">
                                            {contact.name || contact.remote_jid.split('@')[0]}
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400 ml-2">
                                            {formatFriendlyDate(contact.lastTime || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 leading-normal">
                                            {contact.lastMessage || 'Inicie um atendimento'}
                                        </p>
                                        {(contact.unread_count || 0) > 0 && (
                                            <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-lg animate-pulse">
                                                {contact.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {selectedContact?.id === contact.id && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t dark:border-slate-800 flex justify-center gap-4">
                    <button onClick={() => setActiveTab('chats')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all ${activeTab === 'chats' ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                        <span className="material-icons-round text-sm">chat</span> Conversas
                    </button>
                    <button onClick={() => setActiveTab('blocked')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all ${activeTab === 'blocked' ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                        <span className="material-icons-round text-sm">block</span> Bloqueados
                    </button>
                </div>
            </div>

            {/* --- Main Chat Window --- */}
            <div className="flex-1 flex flex-col min-w-0 relative bg-[#F0F2F5] dark:bg-slate-950">
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-patterns opacity-40 select-none">
                        <div className="w-40 h-40 bg-white dark:bg-slate-900 rounded-huge flex items-center justify-center shadow-3xl mb-8 transform rotate-6 border border-white dark:border-slate-800">
                            <span className="material-icons-round text-primary text-8xl">forum</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4 tracking-tighter">Atendimento Inteligente</h2>
                        <p className="text-slate-500 text-center max-w-sm font-medium leading-relaxed">
                            Selecione uma conversa para começar a interagir com seus clientes em tempo real.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="h-[75px] px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white dark:border-slate-800 flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <button className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-primary transition-colors" onClick={() => setIsSidebarOpen(true)}>
                                    <span className="material-icons-round">menu</span>
                                </button>
                                <div className="relative group cursor-pointer" onClick={() => setShowContactInfo(!showContactInfo)}>
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md group-hover:ring-2 ring-primary transition-all">
                                        {selectedContact.profile_pic ? <img src={selectedContact.profile_pic} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xl font-bold">{selectedContact.name?.charAt(0)}</div>}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 ${getStatusColor(selectedContact.status)}`}></div>
                                </div>
                                <div className="min-w-0 cursor-pointer" onClick={() => setShowContactInfo(!showContactInfo)}>
                                    <h3 className="font-black text-slate-800 dark:text-slate-100 truncate text-lg leading-tight">
                                        {selectedContact.name || selectedContact.remote_jid}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedContact.status)} animate-pulse`}></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                            {selectedContact.status === 'open' ? 'Aberto' : selectedContact.status === 'pending' ? 'Pendente' : 'Finalizado'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button onClick={() => updateStatus(selectedContact.id, 'open')} className={`p-2.5 rounded-2xl transition-all ${selectedContact.status === 'open' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-emerald-50'}`} title="Abaerto">
                                    <span className="material-icons-round text-xl">mark_chat_read</span>
                                </button>
                                <button onClick={() => updateStatus(selectedContact.id, 'pending')} className={`p-2.5 rounded-2xl transition-all ${selectedContact.status === 'pending' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-amber-50'}`} title="Pendente">
                                    <span className="material-icons-round text-xl">schedule</span>
                                </button>
                                <button onClick={() => updateStatus(selectedContact.id, 'closed')} className={`p-2.5 rounded-2xl transition-all ${selectedContact.status === 'closed' ? 'bg-slate-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`} title="Finalizar">
                                    <span className="material-icons-round text-xl">check_circle</span>
                                </button>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button onClick={() => { fetchAgents(); setTransferModal(true); }} className="p-2.5 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 hover:scale-105 transition-all" title="Transferir">
                                    <span className="material-icons-round text-xl">shortcut</span>
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-patterns bg-opacity-5">
                            <div className="max-w-4xl mx-auto flex flex-col">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                                        <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md">
                                            <span className="material-icons-round text-4xl">textsms</span>
                                        </div>
                                        <p className="text-sm font-black uppercase tracking-widest opacity-50 italic">Inicie a conversa agora</p>
                                    </div>
                                ) : (
                                    messages.map(renderMessage)
                                )}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 sm:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white dark:border-slate-800">
                            <div className="max-w-4xl mx-auto relative">
                                {/* Recording UI */}
                                {isRecording && (
                                    <div className="absolute inset-x-0 bottom-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-5 shadow-3xl border-2 border-primary/10 flex items-center justify-between">
                                            <div className="flex items-center gap-6">
                                                <div className="relative">
                                                    <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                                                    <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
                                                </div>
                                                <span className="font-black text-2xl text-slate-800 dark:text-slate-100 tabular-nums">
                                                    {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                                                    {(recordingTime % 60).toString().padStart(2, '0')}
                                                </span>
                                                <div className="flex gap-1.5 h-6 items-center">
                                                    {[2, 5, 8, 4, 9, 3, 7, 5, 8, 4, 6, 2, 5].map((h, i) => (
                                                        <div key={i} className="w-1.5 bg-primary rounded-full animate-waveform" style={{ height: `${h * 3}px`, animationDelay: `${i * 0.05}s` }}></div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => stopRecording(false)} className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all">
                                                    <span className="material-icons-round">delete_outline</span>
                                                </button>
                                                <button onClick={() => stopRecording(true)} className="px-8 bg-primary text-white rounded-2xl font-black text-xs shadow-xl shadow-primary/30 hover:scale-105 transition-all uppercase tracking-widest">Enviar Áudio</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-end gap-4 bg-[#F0F2F5] dark:bg-slate-800/80 p-3 rounded-[2.5rem] shadow-inner group-focus-within:ring-2 ring-primary/20 transition-all">
                                    <div className="flex gap-1 pb-1">
                                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${showEmojiPicker ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-primary hover:bg-white/50'}`}>
                                            <span className="material-icons-round text-2xl">sentiment_very_satisfied</span>
                                        </button>
                                        <button onClick={() => fileInputRef.current?.click()} className="w-11 h-11 text-slate-500 hover:text-primary hover:bg-white/50 rounded-full flex items-center justify-center transition-all">
                                            <span className="material-icons-round text-2xl">add_circle_outline</span>
                                        </button>
                                    </div>

                                    <textarea
                                        rows={1}
                                        placeholder="Mensagem..."
                                        value={newMessage}
                                        onChange={(e) => {
                                            setNewMessage(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        className="flex-1 bg-transparent py-3 px-1 text-[16px] max-h-48 resize-none outline-none text-slate-800 dark:text-slate-100 font-medium placeholder:text-slate-400"
                                    />

                                    {newMessage.trim() ? (
                                        <div className="flex gap-2 pb-1 pr-1">
                                            <div className="relative group/ai">
                                                <button className="w-11 h-11 bg-white/50 dark:bg-slate-700/50 text-primary hover:bg-white rounded-full flex items-center justify-center transition-all shadow-sm" title="Melhorar com IA">
                                                    <span className="material-icons-round">auto_awesome</span>
                                                </button>
                                                <div className="absolute bottom-full right-0 mb-4 hidden group-hover/ai:flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-3xl shadow-3xl border border-white dark:border-slate-700 min-w-[180px] animate-in slide-in-from-bottom-2">
                                                    <p className="px-3 pb-1 text-[10px] font-black uppercase text-slate-400 tracking-tighter">Estilo da IA:</p>
                                                    {['Amigável', 'Profissional', 'Explicativo', 'Curto'].map(t => (
                                                        <button key={t} onClick={() => improveText(t.toLowerCase())} className="px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 text-left hover:bg-primary/5 hover:text-primary rounded-xl transition-all">
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={handleSendMessage} className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center shadow-xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all">
                                                <span className="material-icons-round">send</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="pb-1 pr-1">
                                            <button onClick={startRecording} className="w-11 h-11 bg-white dark:bg-slate-700 text-slate-500 hover:text-primary rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-75 transition-all group/mic">
                                                <span className="material-icons-round text-2xl group-active/mic:text-primary group-active/mic:animate-pulse">mic</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-0 mb-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:scale-100 scale-90 origin-bottom-left shadow-3xl">
                                        <EmojiPicker
                                            onEmojiClick={(e) => setNewMessage(p => p + e.emoji)}
                                            theme={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' as any : 'light' as any}
                                            previewConfig={{ showPreview: false }}
                                            skinTonesDisabled
                                            searchDisabled={window.innerWidth < 640}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* --- Drawers & Modals --- */}

                {/* Profile Drawer */}
                {selectedContact && (
                    <div className={`
                        fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] bg-white dark:bg-slate-900 shadow-3xl border-l border-slate-100 dark:border-slate-800
                        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col
                        ${showContactInfo ? 'translate-x-0' : 'translate-x-full shadow-none'}
                    `}>
                        <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
                            <h2 className="font-black uppercase tracking-tight text-xl">Perfil</h2>
                            <button onClick={() => setShowContactInfo(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"><span className="material-icons-round">close</span></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                            <div className="w-40 h-40 rounded-[3.5rem] overflow-hidden shadow-3xl mb-8 border-4 border-white dark:border-slate-800">
                                {selectedContact.profile_pic ? <img src={selectedContact.profile_pic} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-6xl font-black text-slate-300">{selectedContact.name?.charAt(0)}</div>}
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 mt-2">{selectedContact.name || 'Cliente'}</h3>
                            <p className="text-sm font-bold text-slate-400 mb-10 select-all font-mono">WhatsApp: {selectedContact.remote_jid.split('@')[0]}</p>

                            <div className="w-full grid grid-cols-2 gap-4 mb-10 text-center">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <p className={`text-xs font-bold uppercase ${selectedContact.status === 'open' ? 'text-emerald-500' : 'text-slate-400'}`}>{selectedContact.status}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bloqueado</p>
                                    <p className={`text-xs font-bold uppercase ${selectedContact.is_blocked ? 'text-rose-500' : 'text-emerald-500'}`}>{selectedContact.is_blocked ? 'Sim' : 'Não'}</p>
                                </div>
                            </div>

                            <div className="w-full space-y-4">
                                <button onClick={toggleBlock} className={`w-full py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all shadow-inner ${selectedContact.is_blocked ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}>
                                    <span className="material-icons-round">{selectedContact.is_blocked ? 'lock_open' : 'block'}</span>
                                    {selectedContact.is_blocked ? 'Liberar Contato' : 'Bloquear Contato'}
                                </button>
                                <button onClick={deleteConversation} className="w-full py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-[0.2em] bg-slate-900 text-white hover:bg-black flex items-center justify-center gap-4 transition-all shadow-xl shadow-slate-900/10">
                                    <span className="material-icons-round">delete_sweep</span>
                                    Limpar Conversa
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Agent Modal */}
                {transferModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-lg animate-in fade-in duration-500">
                        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-lg p-10 shadow-3xl animate-in zoom-in-95 duration-500 border border-white/20">
                            <div className="flex items-center justify-between mb-10">
                                <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Transferir</h3>
                                <button onClick={() => setTransferModal(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"><span className="material-icons-round">close</span></button>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {agents.length === 0 ? (
                                    <div className="text-center py-10 opacity-30">
                                        <span className="material-icons-round text-6xl mb-4">person_off</span>
                                        <p className="font-bold uppercase tracking-widest text-sm">Nenhum agente online</p>
                                    </div>
                                ) : (
                                    agents.map(agent => (
                                        <button key={agent.id} onClick={() => transferConversation(agent.id)} className="w-full flex items-center gap-5 p-5 rounded-[2rem] hover:bg-primary/5 hover:scale-[1.03] transition-all border border-slate-50 dark:border-slate-800 text-left group">
                                            <div className="w-16 h-16 rounded-[1.25rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all">{agent.name.charAt(0)}</div>
                                            <div className="flex-1">
                                                <p className="font-black text-lg text-slate-800 dark:text-slate-100 leading-none mb-1">{agent.name}</p>
                                                <p className="text-[10px] uppercase font-black text-emerald-500 tracking-widest flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Online
                                                </p>
                                            </div>
                                            <span className="material-icons-round text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">arrow_forward</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>

            <style>{`
                .bg-patterns {
                    background-image: radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px);
                    background-size: 30px 30px;
                }
                .dark .bg-patterns {
                    background-image: radial-gradient(circle, #1e293b 1.5px, transparent 1.5px);
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
                .animate-waveform { animation: waveform 1s ease-in-out infinite; }
                @keyframes waveform { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(2); } }
                .rounded-huge { border-radius: 4rem; }
                .shadow-3xl { box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.2); }
            `}</style>
        </div>
    );
};

export default ChatView;
