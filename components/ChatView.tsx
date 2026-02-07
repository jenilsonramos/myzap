import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useToast } from './ToastContext';
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
    ai_paused?: boolean;
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
    instance_name?: string;
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
    const { showToast } = useToast();
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
    const [isImproving, setIsImproving] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);
    const [messageSearchTerm, setMessageSearchTerm] = useState('');
    const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
    const [showAIOptions, setShowAIOptions] = useState(false);

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
            showToast('Conversa transferida com sucesso!', 'success');
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
            showToast('Não foi possível acessar o microfone.', 'error');
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
                            showToast('Erro ao enviar áudio: ' + (data.error || 'Erro desconhecido'), 'error');
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
                showToast('Erro ao enviar arquivo: ' + (data.error || 'Erro desconhecido'), 'error');
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
        if (!newMessage.trim() || isImproving) return;
        setIsImproving(true);
        setShowAIOptions(false);
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/ai/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: newMessage, tone })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.code === 'AI_NOT_CONFIGURED') {
                    showToast('IA não configurada! Adicione sua API Key (OpenAI ou Gemini) nas Integrações.', 'warning');
                } else {
                    showToast('Erro ao processar IA: ' + (data.error || 'Desconhecido'), 'error');
                }
                setIsImproving(false);
                return;
            }

            if (data.improved) setNewMessage(data.improved);
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão ao tentar usar a IA.', 'error');
        } finally {
            setIsImproving(false);
        }
    };

    const handleMessageSearch = async (query: string) => {
        setMessageSearchTerm(query);
        if (!query.trim() || !selectedContact) {
            setMessageSearchResults([]);
            return;
        }
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/messages/${selectedContact.id}/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessageSearchResults(data);
            }
        } catch (error) {
            console.error('Erro ao pesquisar mensagens:', error);
        }
    };


    const toggleAI = async () => {
        if (!selectedContact) return;
        const newPausedState = !selectedContact.ai_paused;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`${API_URL}/contacts/${selectedContact.id}/toggle-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ paused: newPausedState })
            });
            if (res.ok) {
                const updated = { ...selectedContact, ai_paused: newPausedState };
                setSelectedContact(updated);
                setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
            }
        } catch (err) { showToast('Erro ao alternar IA', 'error'); }
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
            if (obj.stickerMessage) return { type: 'sticker', msg: obj.stickerMessage };

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

            // Normalize URL (handle localhost and relative paths)
            if (mediaUrl.includes('localhost') && !currentOrigin.includes('localhost')) {
                mediaUrl = mediaUrl.replace(/https?:\/\/localhost(:\d+)?/, currentOrigin.replace(/\/$/, ''));
            }

            // WhatsApp Media Proxy Logic (Only for external or encrypted content)
            if (mediaUrl.includes('whatsapp.net') || mediaUrl.includes('.enc') || mediaUrl.includes('mmg.whatsapp.net') || mediaUrl.startsWith('/mms/')) {
                let fullUrl = mediaUrl;
                if (mediaUrl.startsWith('/mms/')) {
                    fullUrl = `https://mmg.whatsapp.net${mediaUrl}`;
                }
                const apiPath = `/api/media/proxy?url=${encodeURIComponent(fullUrl)}&msgId=${msg.uid || ''}&instance=${msg.instance_name || ''}&remoteJid=${encodeURIComponent(selectedContact?.remote_jid || '')}&fromMe=${msg.key_from_me ? 'true' : 'false'}`;
                mediaUrl = `${baseUrl.replace(/\/$/, '')}${apiPath}`;
            } else if (!mediaUrl.startsWith('http')) {
                // Ensure local uploads use the absolute API path
                const path = mediaUrl.startsWith('/') ? mediaUrl : `/api/uploads/${mediaUrl}`;
                mediaUrl = `${baseUrl.replace(/\/$/, '')}${path}`;
            }
        }

        return { content, type, mediaUrl };
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
        <div className="h-full w-full flex bg-[#fbfbfc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 modern-chat overflow-hidden relative spring-motion">
            {/* Signature Overlay - High Priority noise */}
            <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.08] mix-blend-overlay signature-material-overlay"></div>


            {/* Sidebar de Contatos (Minimalista Industrial) */}
            <div className={`
                ${isSidebarCollapsed ? 'w-20' : 'w-80'} 
                border-r border-slate-200/50 dark:border-white/5 flex flex-col bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out
            `}>
                {/* Header da Sidebar */}
                <div className="p-6 flex items-center justify-between">
                    {!isSidebarCollapsed && <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">Chat</h2>}
                    <div className="flex items-center gap-2">
                        {!isSidebarCollapsed && (
                            <button className="w-10 h-10 bg-[#3b66f5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform">
                                <span className="material-icons-round">add</span>
                            </button>
                        )}
                        <button
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-all spring-motion active-scale-spring"
                        >
                            <span className="material-icons-round text-xl">
                                {isSidebarCollapsed ? 'menu_open' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Cápsula de Tabs */}
                {!isSidebarCollapsed && (
                    <div className="px-6 mb-6">
                        <div className="capsule-tab-container flex">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`flex-1 capsule-tab ${filterStatus === 'all' ? 'capsule-tab-active' : 'text-slate-400 dark:text-slate-500'}`}
                            >
                                Aberto
                            </button>
                            <button
                                onClick={() => setFilterStatus('closed')}
                                className={`flex-1 capsule-tab ${filterStatus === 'closed' ? 'capsule-tab-active' : 'text-slate-400 dark:text-slate-500'}`}
                            >
                                Arquivado
                            </button>
                        </div>
                    </div>
                )}

                {/* Busca */}
                <div className="px-4 mb-4">
                    <div className="relative group">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg group-focus-within:text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder={isSidebarCollapsed ? "" : "Buscar..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`
                                w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 py-2.5 rounded-lg outline-none text-sm transition-all text-slate-700 dark:text-slate-200
                                ${isSidebarCollapsed ? 'px-0 text-center placeholder:opacity-0' : 'pl-10 pr-4 focus:ring-2 focus:ring-slate-100 dark:focus:ring-white/5 focus:bg-white dark:focus:bg-slate-800'}
                            `}
                        />
                    </div>
                </div>

                {/* Lista de Contatos */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                    {filteredContacts.map(c => (
                        <div
                            key={c.id}
                            onClick={() => {
                                setSelectedContact(c);
                                fetchMessages(c.id);
                                markAsRead(c.id);
                            }}
                            className={`
                                group flex items-center px-6 py-4 cursor-pointer transition-all soft-card
                                ${selectedContact?.id === c.id ? 'soft-card-selected' : 'hover:bg-slate-50/50 dark:hover:bg-white/5'}
                            `}
                        >
                            <div className={`relative shrink-0 ${isSidebarCollapsed ? 'border-2 border-slate-200 dark:border-white/10 rounded-full p-0.5' : ''}`}>
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                                    {c.profile_pic ? (
                                        <img src={c.profile_pic} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 text-lg">
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${getStatusColor(c.status)}`}></div>
                            </div>

                            {!isSidebarCollapsed && (
                                <div className="flex-1 min-w-0 ml-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 truncate leading-none">{c.name}</h3>
                                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase industrial-mono">{formatFriendlyDate(c.lastTime)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[13px] text-slate-400 dark:text-slate-500 truncate pr-4 font-medium leading-tight">
                                            {c.last_message || 'Inicie uma conversa...'}
                                        </p>
                                        {c.unread_count > 0 && (
                                            <div className="pink-badge scale-90 animate-in zoom-in-50 duration-300">
                                                {c.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Janela de Chat Principal */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 select-none bg-slate-50/20 dark:bg-slate-950/20">
                        <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-slate-100 dark:shadow-black/20 border border-slate-50 dark:border-white/5 group transition-transform hover:scale-110 duration-500">
                            <span className="material-icons-round text-5xl text-blue-500 opacity-20 group-hover:opacity-100 transition-opacity">forum</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">Seu Chat de Elite</h2>
                        <p className="text-slate-400 dark:text-slate-500 mt-3 font-medium text-center max-w-xs">Selecione um contato para experimentar a nova interface ultra-minimalista.</p>
                    </div>
                ) : (
                    <>
                        {/* Header do Chat */}
                        <div className="h-20 px-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden relative">
                                    {selectedContact.profile_pic ? (
                                        <img src={selectedContact.profile_pic} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 font-bold">
                                            {selectedContact.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-[17px] font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{selectedContact.name}</h2>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedContact.status)} animate-pulse-soft`}></div>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest industrial-mono">online</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {isSearchingMessages ? (
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-1.5 border border-slate-100 dark:border-white/5 animate-in slide-in-from-right-4 duration-300">
                                        <span className="material-icons-round text-slate-400 text-sm">search</span>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={messageSearchTerm}
                                            onChange={(e) => handleMessageSearch(e.target.value)}
                                            placeholder="Pesquisar mensagens..."
                                            className="bg-transparent border-none focus:ring-0 text-sm py-0 w-40 text-slate-600 dark:text-slate-200"
                                        />
                                        <button onClick={() => { setIsSearchingMessages(false); setMessageSearchTerm(''); setMessageSearchResults([]); }} className="text-slate-400 hover:text-slate-600">
                                            <span className="material-icons-round text-sm">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setIsSearchingMessages(true); fetchMessages(selectedContact.id); }}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-slate-100 dark:border-white/5"
                                        title="Pesquisar mensagens"
                                    >
                                        <span className="material-icons-round text-xl">search</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => { fetchAgents(); setTransferModal(true); }}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-slate-100 dark:border-white/5"
                                    title="Transferir conversa"
                                >
                                    <span className="material-icons-round text-xl">sync_alt</span>
                                </button>
                                <button
                                    onClick={() => setShowContactInfo(!showContactInfo)}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${showContactInfo ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-500' : 'text-slate-400 dark:text-slate-500 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                >
                                    <span className="material-icons-round text-xl">person_outline</span>
                                </button>
                            </div>
                        </div>

                        {/* Área de Mensagens */}
                        <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8 bg-[#fbfbfc] dark:bg-slate-950 custom-scrollbar">
                            {isSearchingMessages && messageSearchTerm.trim() !== '' && messageSearchResults.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                                    <span className="material-icons-round text-4xl mb-2">search_off</span>
                                    <p>Nenhuma mensagem encontrada para "{messageSearchTerm}"</p>
                                </div>
                            )}
                            {(isSearchingMessages && messageSearchTerm.trim() !== '' ? messageSearchResults : messages).map((msg, index) => {
                                const currentList = (isSearchingMessages && messageSearchTerm.trim() !== '' ? messageSearchResults : messages);
                                const isMe = !!msg.key_from_me;
                                const { content, type, mediaUrl } = getMessageContent(msg);
                                const prevMsg = currentList[index - 1];
                                const isSameAsPrev = !!(prevMsg && !!prevMsg.key_from_me === isMe);

                                return (
                                    <div key={msg.id} className={`flex gap-4 ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSameAsPrev ? 'mt-1.5' : 'mt-8'}`}>
                                        {!isMe && !isSameAsPrev && (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 mt-1 overflow-hidden border border-slate-100 dark:border-white/10">
                                                {selectedContact.profile_pic ? (
                                                    <img src={selectedContact.profile_pic} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 text-sm font-bold">
                                                        {selectedContact.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {isMe && !isSameAsPrev && (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 mt-1 overflow-hidden border border-slate-100 dark:border-white/10 order-last">
                                                {(() => {
                                                    const userStr = localStorage.getItem('myzap_user');
                                                    const user = userStr ? JSON.parse(userStr) : null;
                                                    return user?.profile_pic ? (
                                                        <img src={user.profile_pic} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                                                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        {((!isMe && isSameAsPrev) || (isMe && isSameAsPrev)) && <div className="w-10 h-10 shrink-0" />}

                                        <div className={`
                                            max-w-[75%] bubble-soft spring-motion rounded-[2rem]
                                            ${isMe ? 'bubble-me' : 'bubble-other'}
                                        `}>
                                            <div className="px-1 py-0.5">
                                                {type === 'image' && mediaUrl && (
                                                    <div className="rounded-xl overflow-hidden mb-2">
                                                        <img src={mediaUrl} className="max-h-72 w-full object-contain cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} alt="" />
                                                    </div>
                                                )}
                                                {type === 'video' && mediaUrl && (
                                                    <div className="rounded-xl overflow-hidden mb-2">
                                                        <video src={mediaUrl} controls className="max-h-72 w-full" />
                                                    </div>
                                                )}
                                                {type === 'audio' && mediaUrl && (
                                                    <div className="audio-wave-container min-w-[240px] border border-blue-50 dark:border-white/5 py-3 px-4">
                                                        <audio
                                                            src={mediaUrl}
                                                            className="w-full h-8 opacity-80"
                                                            controls
                                                            onError={(e) => console.error('Audio Error:', mediaUrl, e)}
                                                        />
                                                    </div>
                                                )}
                                                {type === 'document' && mediaUrl && (
                                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 mb-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')}>
                                                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
                                                            <span className="material-icons-round">description</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold truncate dark:text-slate-100">{content || 'Documento'}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase industrial-mono">Clique para abrir</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {type === 'sticker' && mediaUrl && (
                                                    <div className="w-32 h-32 mb-2">
                                                        <img src={mediaUrl} className="w-full h-full object-contain" alt="" />
                                                    </div>
                                                )}
                                                {type === 'text' && content && (
                                                    <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">{content}</p>
                                                )}

                                                <div className="flex items-center justify-end gap-2 mt-2">
                                                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase industrial-mono">
                                                        {new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {!!isMe && (
                                                        <span className={`material-icons-round text-sm ${msg.status === 'read' ? 'text-blue-500' : 'text-slate-200 dark:text-slate-700'}`}>
                                                            {msg.status === 'read' ? 'done_all' : 'done'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Mensagem Flutuante */}
                        <div className="px-10 pb-10 pt-4 bg-[#fbfbfc] dark:bg-slate-950">
                            {/* AI Options Menu */}
                            {showAIOptions && (
                                <div className="mb-4 p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-industrial-lg border border-slate-100 dark:border-white/5 flex gap-2 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-4 duration-300">
                                    {[
                                        { id: 'serio', label: 'Tom sério', icon: 'gavel' },
                                        { id: 'educado', label: 'Educado', icon: 'sentiment_satisfied' },
                                        { id: 'firme', label: 'Bravo', icon: 'priority_high' },
                                        { id: 'engracado', label: 'Engraçado', icon: 'celebration' },
                                        { id: 'profissional', label: 'Profissional', icon: 'business_center' },
                                        { id: 'ortografia', label: 'Corrigir ortografia', icon: 'spellcheck' },
                                    ].map(tone => (
                                        <button
                                            key={tone.id}
                                            onClick={() => improveText(tone.id)}
                                            className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold text-xs"
                                        >
                                            <span className="material-icons-round text-sm">{tone.icon}</span>
                                            {tone.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="floating-input-container flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setShowAIOptions(!showAIOptions)}
                                        className={`p-2.5 transition-colors ${showAIOptions ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                        title="Melhorar com IA"
                                    >
                                        <span className="material-icons-round text-2xl">auto_awesome</span>
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors"
                                    >
                                        <span className="material-icons-round text-2xl">image</span>
                                    </button>
                                </div>
                                {isRecording ? (
                                    <div className="flex-1 flex items-center justify-between px-4 py-3 bg-rose-50 dark:bg-rose-900/20 rounded-full animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                                            <span className="text-rose-600 dark:text-rose-400 font-bold industrial-mono">
                                                {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => stopRecording(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">
                                                <span className="material-icons-round">delete</span>
                                            </button>
                                            <button onClick={() => stopRecording(true)} className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 hover:scale-105 transition-transform">
                                                <span className="material-icons-round">send</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Digite sua mensagem..."
                                            className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-4 placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-600 dark:text-slate-200 font-medium"
                                        />
                                        <div className="pr-1 flex items-center gap-1">
                                            {newMessage.trim() === '' ? (
                                                <button
                                                    onClick={startRecording}
                                                    className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all"
                                                >
                                                    <span className="material-icons-round text-2xl">mic</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleSendMessage}
                                                    className="send-btn-circle hover:scale-105 active:scale-95 transition-all text-white shadow-lg shadow-blue-500/30"
                                                >
                                                    <span className="material-icons-round text-2xl">send</span>
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Painel de Informações do Contato (Retrátil) */}
            {showContactInfo && selectedContact && (
                <div className="w-96 border-l border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-500 ease-out shadow-2xl shadow-slate-200/50 dark:shadow-black/50 z-20">
                    <div className="p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Detalhes do Contato</h4>
                        <button
                            onClick={() => setShowContactInfo(false)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <span className="material-icons-round">close</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 rounded-full bg-slate-50 dark:bg-slate-800 mb-6 border-4 border-white dark:border-slate-800 shadow-xl shadow-slate-100 dark:shadow-black/20 overflow-hidden relative group">
                                {selectedContact.profile_pic ? (
                                    <img src={selectedContact.profile_pic} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-5xl font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30">{selectedContact.name?.charAt(0)}</div>
                                )}
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 text-center leading-tight mb-2">{selectedContact.name}</h3>
                            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-white/5">
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 industrial-mono">+{selectedContact.remote_jid.split('@')[0]}</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <p className="text-[11px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Configurações Rápidas</p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg dark:hover:shadow-black/20 hover:shadow-slate-100 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm">
                                            <span className="material-icons-round">smart_toy</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Automação IA</p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Resposta Inteligente</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleAI}
                                        className={`w-14 h-7 rounded-full transition-all relative ${selectedContact.ai_paused ? 'bg-slate-200 dark:bg-slate-700' : 'bg-blue-500 shadow-md shadow-blue-200 dark:shadow-blue-500/20'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${selectedContact.ai_paused ? 'left-1' : 'left-8'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm">
                                            <span className="material-icons-round">offline_bolt</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Status Ativo</p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{selectedContact.status}</p>
                                        </div>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedContact.status)} shadow-lg`} />
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-50 dark:border-white/5 space-y-4">
                            <button
                                onClick={toggleBlock}
                                className={`w-full py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest border transition-all active-scale-spring ${selectedContact.is_blocked ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-100 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20'}`}
                            >
                                {selectedContact.is_blocked ? 'Desbloquear Contato' : 'Bloquear Contato'}
                            </button>
                            <button
                                onClick={deleteConversation}
                                className="w-full py-5 bg-slate-900 dark:bg-black hover:bg-black dark:hover:bg-slate-800 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl shadow-slate-200 dark:shadow-black/20 active-scale-spring transition-all"
                            >
                                Apagar Histórico
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {transferModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-industrial-lg border border-slate-200/50 animate-in zoom-in-95 duration-500 ease-out">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Transferir Chat</h3>
                            <button onClick={() => setTransferModal(false)} className="text-slate-400 hover:text-slate-600"><span className="material-icons-round">close</span></button>
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                            {agents.map(agent => (
                                <button
                                    key={agent.id}
                                    onClick={() => transferConversation(agent.id)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500">{agent.name.charAt(0)}</div>
                                    <p className="flex-1 font-semibold text-sm text-slate-700">{agent.name}</p>
                                    <span className="material-icons-round text-slate-300">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Input */}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

            {/* Estilos Globais Reduzidos */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
                
                .modern-chat {
                    font-family: 'Outfit', sans-serif !important;
                }

                .modern-chat input, 
                .modern-chat textarea, 
                .modern-chat button {
                    font-family: 'Outfit', sans-serif !important;
                }

                .industrial-mono {
                    font-family: 'JetBrains Mono', monospace !important;
                    letter-spacing: -0.02em;
                }

                /* Soft Minimalist UI (Based on Reference) */
                .soft-card {
                    background: #ffffff;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .dark .soft-card {
                    background: #0f172a;
                }
                .soft-card-selected {
                    background: #f8faff;
                    position: relative;
                }
                .dark .soft-card-selected {
                    background: rgba(59, 102, 245, 0.1);
                }
                .soft-card-selected::after {
                    content: "";
                    position: absolute;
                    right: 0;
                    top: 15%;
                    bottom: 15%;
                    width: 3px;
                    background: #3b66f5;
                    border-radius: 4px 0 0 4px;
                }

                .capsule-tab-container {
                    background: #f1f3f9;
                    border-radius: 100px;
                    padding: 6px;
                }
                .dark .capsule-tab-container {
                    background: rgba(255,255,255,0.05);
                }
                .capsule-tab {
                    border-radius: 100px;
                    padding: 6px 20px;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .capsule-tab-active {
                    background: #ffffff;
                    color: #3b66f5;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .dark .capsule-tab-active {
                    background: #3b66f5;
                    color: white;
                }

                .pink-badge {
                    background: #ff3b8d;
                    color: white;
                    min-width: 20px;
                    height: 20px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 800;
                }

                /* Message Bubbles - Soft Elite */
                .bubble-soft {
                    border-radius: 20px;
                    padding: 12px 18px;
                    box-shadow: 0 2px 15px rgba(0,0,0,0.03);
                    border: 1px solid rgba(0,0,0,0.02);
                }
                .bubble-me {
                    background: #ffffff;
                    color: #333;
                    border-top-right-radius: 8px;
                }
                .dark .bubble-me {
                    background: #1e293b;
                    border-color: rgba(255,255,255,0.05);
                    color: #f1f5f9;
                }
                .bubble-other {
                    background: #ffffff;
                    color: #333;
                    border-top-left-radius: 8px;
                }
                .dark .bubble-other {
                    background: #0f172a;
                    border-color: rgba(255,255,255,0.05);
                    color: #f1f5f9;
                }

                /* Audio - Soft Gradient */
                .audio-wave-container {
                    background: linear-gradient(90deg, #edf2ff 0%, #ffffff 100%);
                    border-radius: 100px;
                    padding: 8px 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .dark .audio-wave-container {
                    background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
                }
                .play-btn-circle {
                    width: 36px;
                    height: 36px;
                    background: #3b66f5;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 10px rgba(59, 102, 245, 0.3);
                }

                /* Input Area - Floating */
                .floating-input-container {
                    background: #ffffff;
                    border-radius: 100px;
                    padding: 4px 4px 4px 20px;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.04);
                    border: 1px solid #f0f0f5;
                }
                .dark .floating-input-container {
                    background: #0f172a;
                    border-color: rgba(255,255,255,0.05);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .send-btn-circle {
                    width: 48px;
                    height: 48px;
                    background: #3b66f5;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 102, 245, 0.4);
                }

                /* Signature Noise Overlay - Softened */
                .signature-material-overlay {
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                    opacity: 0.04;
                }

                .spring-motion {
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .active-scale-spring:active {
                    transform: scale(0.95);
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                }

                /* Waveform Animation */
                @keyframes waveform {
                    0% { height: 4px; }
                    50% { height: 16px; }
                    100% { height: 4px; }
                }
                .waveform-bar {
                    width: 2px;
                    background: #3b82f6;
                    border-radius: 2px;
                    animation: waveform 1s ease-in-out infinite;
                }
                .waveform-bar:nth-child(2) { animation-delay: 0.1s; }
                .waveform-bar:nth-child(3) { animation-delay: 0.2s; }
                .waveform-bar:nth-child(4) { animation-delay: 0.3s; }
                .waveform-bar:nth-child(5) { animation-delay: 0.4s; }

                /* Avatar Premium Rings */
                .avatar-ring {
                    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #e2e8f0;
                    transition: all 0.3s ease;
                }
                .avatar-ring-active {
                    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #10b981;
                }

                textarea {
                    line-height: 1.6 !important;
                }

                /* Animação de Pulso Industrial */
                @keyframes pulse-soft {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(0.95); }
                }
                .animate-pulse-soft {
                    animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }

                .input-sheen-focus:focus-within {
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.05);
                    border-color: rgba(59, 130, 246, 0.3);
                }
            `}</style>
        </div>
    );
};

export default ChatView;
