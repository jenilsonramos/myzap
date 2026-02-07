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

            const settings = JSON.parse(localStorage.getItem('myzap_settings') || '{}');
            const baseUrl = settings.app_url || window.location.origin;
            const apiPath = `/api/media/proxy?url=${encodeURIComponent(fullUrl)}&msgId=${msg.uid || ''}&instance=${msg.instance_name || ''}&remoteJid=${encodeURIComponent(selectedContact?.remote_jid || '')}&fromMe=${msg.key_from_me ? 'true' : 'false'}`;

            mediaUrl = `${baseUrl.replace(/\/$/, '')}${apiPath}`;
        }

        return { content, type, mediaUrl };
    };

    const renderMessage = (msg: Message) => {
        const isMe = msg.key_from_me;
        const { content, type, mediaUrl } = getMessageContent(msg);

        return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-8 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out`}>
                <div className={`
                    max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] p-1.5 rounded-[2.5rem] shadow-sm relative transition-all duration-500
                    ${isMe ? 'bg-gradient-to-br from-primary to-blue-600 text-white rounded-tr-none shadow-blue-200/50' :
                        msg.source === 'ai' ? 'bg-white/80 text-indigo-900 rounded-tl-none border border-indigo-100 shadow-indigo-100/30' :
                            'bg-white text-slate-800 rounded-tl-none border border-slate-200/60 shadow-slate-200/30'}
                `}>
                    <div className="p-3.5 sm:p-5">
                        {type === 'image' && mediaUrl && (
                            <div className="relative group overflow-hidden rounded-[2rem] mb-4 border border-white/20 shadow-lg">
                                <img src={mediaUrl} className="max-h-96 w-full object-contain bg-black/5 cursor-pointer hover:scale-[1.03] transition-transform duration-700 ease-out" onClick={() => window.open(mediaUrl, '_blank')} alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none flex items-end p-4">
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">Expandir</span>
                                </div>
                            </div>
                        )}
                        {type === 'video' && mediaUrl && (
                            <div className="rounded-[2rem] overflow-hidden mb-4 border border-white/20 shadow-lg bg-black/5">
                                <video src={mediaUrl} controls className="w-full max-h-96" />
                            </div>
                        )}
                        {type === 'sticker' && mediaUrl && (
                            <div className="relative group flex justify-center py-4">
                                <img src={mediaUrl} className="max-w-[180px] max-h-[180px] object-contain cursor-pointer drop-shadow-2xl hover:scale-110 transition-transform duration-500" alt="" />
                            </div>
                        )}
                        {type === 'audio' && mediaUrl && (
                            <div className="min-w-[260px] py-2 px-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`p-2 rounded-full ${isMe ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                                        <span className="material-icons-round text-lg">mic</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isMe ? 'text-white/70' : 'text-slate-400'}`}>Mensagem de áudio</span>
                                </div>
                                <audio
                                    src={mediaUrl}
                                    controls
                                    preload="metadata"
                                    className={`w-full h-8 ${isMe ? 'filter invert brightness-200 opacity-80' : 'opacity-90'}`}
                                >
                                    <source src={mediaUrl} type="audio/ogg" />
                                    <source src={mediaUrl} type="audio/mpeg" />
                                </audio>
                            </div>
                        )}
                        {type === 'document' && mediaUrl && (
                            <div className={`flex items-center gap-4 p-4 ${isMe ? 'bg-white/10 border-white/10' : 'bg-slate-50 border-slate-100'} rounded-2xl border mb-3 group transition-all`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isMe ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'} shadow-inner`}>
                                    <span className="material-icons-round text-2xl">description</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate font-bold ${isMe ? 'text-white' : 'text-slate-800'}`}>{content || 'Documento'}</p>
                                    <p className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${isMe ? 'text-white/50' : 'text-slate-400'}`}>Arquivo / {type.toUpperCase()}</p>
                                </div>
                                <a href={mediaUrl} target="_blank" rel="noreferrer" className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isMe ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`} onClick={(e) => e.stopPropagation()}><span className="material-icons-round text-lg">download</span></a>
                            </div>
                        )}
                        {type === 'text' && content && <p className="text-[15px] whitespace-pre-wrap leading-relaxed py-1 px-1 font-medium tracking-tight overflow-hidden text-ellipsis">{content}</p>}

                        <div className={`flex items-center justify-end gap-2.5 mt-2.5 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                            {msg.source === 'ai' && (
                                <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/10">
                                    <span className="material-icons-round text-[10px] text-indigo-500" title="Assistente IA">auto_awesome</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600">IA</span>
                                </div>
                            )}
                            <span className="text-[10px] font-bold tracking-tight opacity-70">
                                {new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && !msg.isPending && (
                                <span className={`material-icons-round text-[18px] -ml-0.5 ${msg.status === 'read' ? 'text-blue-200' : 'opacity-50'}`}>
                                    {msg.status === 'read' ? 'done_all' : 'done'}
                                </span>
                            )}
                            {msg.isPending && <span className="material-icons-round text-[14px] animate-spin opacity-50">sync</span>}
                        </div>
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
        <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-rose-100 p-4 sm:p-6 flex overflow-hidden font-outfit text-slate-900">
            {/* --- Main Dashboard Container --- */}
            <div className="flex-1 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] flex overflow-hidden border border-white/60 relative">

                {/* 1. Global Navigation Sidebar (Left) */}
                <div className="w-20 sm:w-24 border-r border-slate-200/60 flex flex-col items-center py-8 gap-12 bg-white/20 backdrop-blur-md">
                    <div className="p-3.5 bg-gradient-to-br from-[#00A3FF] to-[#0055FF] rounded-2xl shadow-[0_10px_20px_-5px_rgba(0,85,255,0.4)] rotate-3 hover:rotate-0 transition-all duration-500 cursor-pointer group">
                        <span className="material-icons-round text-white text-2xl group-hover:scale-110 transition-transform">api</span>
                    </div>

                    <div className="flex-1 flex flex-col gap-6 text-slate-400">
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">grid_view</span></button>
                        <button className="text-primary transition-all p-3 rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,85,255,0.1)] border border-blue-50/50"><span className="material-icons-round text-2xl">chat_bubble</span></button>
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">calendar_today</span></button>
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">folder</span></button>
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">shopping_bag</span></button>
                        <div className="h-px w-10 bg-slate-200/60 mx-auto my-4"></div>
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">near_me</span></button>
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">campaign</span></button>
                    </div>

                    <div className="flex flex-col gap-6 text-slate-400 mb-2">
                        <button className="hover:text-primary transition-all p-3 rounded-2xl hover:bg-white/80 hover:shadow-sm"><span className="material-icons-round text-2xl">settings</span></button>
                        <button className="hover:text-rose-500 transition-all p-3 rounded-2xl hover:bg-rose-50 hover:shadow-sm"><span className="material-icons-round text-2xl">logout</span></button>
                    </div>
                </div>

                {/* 2. Chat List Sidebar (Middle-Left) */}
                <div className="w-[320px] sm:w-[380px] border-r border-slate-200/60 flex flex-col bg-slate-50/20 overflow-hidden">
                    <div className="p-6 sm:p-8 flex items-center justify-between">
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Conversas</h2>
                        <button className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-white rounded-2xl shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group">
                            <span className="material-icons-round text-2xl group-hover:rotate-90 transition-transform duration-500">add</span>
                        </button>
                    </div>

                    <div className="px-6 sm:px-8 mb-4">
                        <div className="relative group">
                            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-all duration-300">search</span>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/60 pl-12 pr-4 py-3.5 rounded-2xl border border-white shadow-sm outline-none focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all text-sm font-medium placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="px-6 sm:px-8 mb-6">
                        <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-1.5 shadow-sm border border-white/60 flex gap-1">
                            {(['open', 'closed'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s === 'open' ? 'open' : 'closed')}
                                    className={`
                                        flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                                        ${(filterStatus === 'all' && s === 'open') || (filterStatus === s)
                                            ? 'bg-white shadow-md border border-slate-100 text-primary translate-y-[-1px]'
                                            : 'text-slate-400 hover:text-slate-600'}
                                    `}
                                >
                                    {s === 'open' ? 'Abertos' : 'Finalizados'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 custom-scrollbar space-y-3 pb-8">
                        {filteredContacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 opacity-30 select-none">
                                <span className="material-icons-round text-6xl mb-4 text-slate-300">forum</span>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center text-slate-400">Nenhuma conversa</p>
                            </div>
                        ) : (
                            filteredContacts.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        setSelectedContact(c);
                                        fetchMessages(c.id);
                                        markAsRead(c.id);
                                    }}
                                    className={`
                                        group flex items-center gap-4 p-4 rounded-[2rem] cursor-pointer transition-all duration-500 relative
                                        ${selectedContact?.id === c.id
                                            ? 'bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-white scale-[1.02] active:scale-[0.98]'
                                            : 'hover:bg-white/60'}
                                    `}>
                                    <div className="relative shrink-0">
                                        <div className={`w-14 h-14 rounded-[1.25rem] text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-black/5 ${getStatusColor(c.status)}`}>
                                            {c.profile_pic ? (
                                                <img src={c.profile_pic} className="w-full h-full object-cover rounded-[1.25rem]" alt="" />
                                            ) : (
                                                c.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white ${getStatusColor(c.status)}`}></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-bold text-slate-800 truncate text-[15px]">{c.name}</h3>
                                            {c.lastTime && <span className="text-[10px] text-slate-400 font-bold">{formatFriendlyDate(c.lastTime)}</span>}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-slate-500 truncate font-medium">{c.lastMessage || 'Inicie um atendimento'}</p>
                                            {c.unread_count > 0 && <span className="h-5 min-w-[20px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-rose-200">{c.unread_count}</span>}
                                        </div>
                                    </div>
                                    {selectedContact?.id === c.id && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-l-full shadow-[0_0_15px_rgba(0,85,255,0.5)]"></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. Main Chat Window (Middle-Right) */}
                <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-sm">
                    {/* Top utility bar */}
                    <div className="h-20 px-6 sm:px-10 border-b border-slate-200/60 flex items-center justify-between bg-white/40 backdrop-blur-md">
                        <div className="relative group w-full max-w-md">
                            <span className="material-icons-round absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">search</span>
                            <input
                                type="text"
                                placeholder="Procurar mensagens ou arquivos..."
                                className="w-full bg-transparent pl-10 pr-4 py-2 outline-none text-slate-600 placeholder:text-slate-300 font-medium text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-4 sm:gap-8 text-slate-400">
                            <div className="relative cursor-pointer transition-all hover:text-primary">
                                <span className="material-icons-round">notifications</span>
                                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                            </div>
                            <div className="flex items-center gap-3 pl-4 border-l border-slate-200/60">
                                <div className="w-9 h-9 rounded-xl border-2 border-white shadow-md overflow-hidden relative">
                                    <img src="https://ui-avatars.com/api/?name=Admin&background=0055FF&color=fff" className="w-full h-full object-cover" alt="" />
                                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></div>
                                </div>
                                <span className="material-icons-round text-slate-300 cursor-pointer hover:text-slate-500 transition-colors">expand_more</span>
                            </div>
                        </div>
                    </div>

                    {!selectedContact ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-40 select-none">
                            <div className="w-32 h-32 bg-slate-100 rounded-[3rem] flex items-center justify-center mb-8 rotate-3 shadow-inner">
                                <span className="material-icons-round text-6xl text-primary/40">forum</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight text-slate-800 text-center">Selecione uma conversa<br /><span className="text-lg font-medium text-slate-400">para começar a trocar mensagens</span></h2>
                        </div>
                    ) : (
                        <>
                            {/* Chat Toolbar */}
                            <div className="px-6 sm:px-10 py-5 flex items-center justify-between border-b border-slate-200/60 bg-white/20">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl text-white font-bold text-xl flex items-center justify-center ${getStatusColor(selectedContact.status)} shadow-lg shadow-black/5`}>
                                        {selectedContact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 tracking-tight text-lg leading-tight">{selectedContact.name}</h3>
                                        <div className="flex items-center gap-4 mt-0.5">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedContact.status)} animate-pulse`}></span>
                                                {selectedContact.status === 'open' ? 'Ativo' : selectedContact.status === 'pending' ? 'Pendente' : 'Finalizado'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-3">
                                    <button onClick={() => updateStatus(selectedContact.id, 'open')} className="w-10 h-10 rounded-xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all flex items-center justify-center group" title="Marcar como Aberto"><span className="material-icons-round text-xl group-hover:scale-110">mark_chat_read</span></button>
                                    <button onClick={() => updateStatus(selectedContact.id, 'closed')} className="w-10 h-10 rounded-xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-500 transition-all flex items-center justify-center group" title="Marcar como Resolvido"><span className="material-icons-round text-xl group-hover:scale-110">check_circle</span></button>
                                    <button onClick={() => { fetchAgents(); setTransferModal(true); }} className="w-10 h-10 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-500 transition-all flex items-center justify-center group" title="Transferir Agente"><span className="material-icons-round text-xl group-hover:translate-x-1 group-hover:translate-y-[-1px]">shortcut</span></button>
                                    <button onClick={toggleAI} className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center group ${selectedContact.ai_paused ? 'bg-indigo-50 text-indigo-500 shadow-sm border border-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-500'}`} title={selectedContact.ai_paused ? 'Ativar IA' : 'Pausar IA'}>
                                        <span className={`material-icons-round text-xl group-hover:scale-110 ${!selectedContact.ai_paused ? 'animate-pulse' : ''}`}>{selectedContact.ai_paused ? 'play_circle' : 'auto_awesome'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 space-y-2 custom-scrollbar bg-slate-50/10 relative">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                {messages.map(msg => renderMessage(msg))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-6 sm:p-10 bg-white/40">
                                {isRecording ? (
                                    <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-4 sm:p-6 shadow-2xl border-2 border-primary/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
                                        <div className="flex items-center gap-4 sm:gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                                                <span className="font-black text-xl sm:text-2xl text-slate-800 tabular-nums">
                                                    {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                                                    {(recordingTime % 60).toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <div className="hidden sm:flex gap-1 h-6 items-center">
                                                {[5, 8, 4, 9, 3, 7, 5, 8, 4, 6].map((h, i) => (
                                                    <div key={i} className="w-1 bg-primary/30 rounded-full animate-pulse" style={{ height: `${h * 2.5}px`, animationDelay: `${i * 0.1}s` }}></div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 sm:gap-3">
                                            <button onClick={() => stopRecording(false)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm" title="Cancelar"><span className="material-icons-round">delete_outline</span></button>
                                            <button onClick={() => stopRecording(true)} className="px-5 sm:px-8 bg-primary text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all">Enviar Áudio</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-2.5 flex items-center gap-2 border border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] group transition-all duration-500 focus-within:shadow-[0_20px_50px_-10px_rgba(0,85,255,0.1)] focus-within:border-primary/20">
                                        <div className="flex gap-1">
                                            <button
                                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-primary transition-all flex items-center justify-center"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                title="Emojis"
                                            >
                                                <span className="material-icons-round text-2xl">sentiment_satisfied</span>
                                            </button>
                                            <button
                                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-primary transition-all flex items-center justify-center"
                                                onClick={() => fileInputRef.current?.click()}
                                                title="Anexar Arquivo"
                                            >
                                                <span className="material-icons-round text-2xl">add_circle_outline</span>
                                            </button>
                                        </div>
                                        <textarea
                                            rows={1}
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
                                            placeholder="Digite sua mensagem..."
                                            className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] font-medium text-slate-700 placeholder:text-slate-400 resize-none py-3 px-2 custom-scrollbar max-h-48"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={startRecording}
                                                className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 text-slate-400 rounded-2xl hover:text-primary hover:bg-white hover:shadow-md transition-all flex items-center justify-center"
                                                title="Gravar Áudio"
                                            >
                                                <span className="material-icons-round text-2xl">mic</span>
                                            </button>
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl shadow-lg transition-all flex items-center justify-center group ${newMessage.trim() ? 'bg-primary text-white shadow-blue-200 hover:scale-110 active:scale-95' : 'bg-slate-100 text-slate-300'}`}
                                            >
                                                <span className="material-icons-round rotate-[-45deg] mb-1 ml-1 text-2xl group-hover:translate-x-0.5 group-hover:translate-y-[-0.5px] transition-transform">send</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 4. Contact Information Sidebar (Right) */}
                <div className="w-[320px] sm:w-[380px] border-l border-slate-200/60 flex flex-col bg-slate-50/10">
                    {!selectedContact ? (
                        <div className="flex-1 flex items-center justify-center p-10 text-slate-200 font-black italic rotate-[-90deg] uppercase tracking-[1.5em] select-none opacity-50">Informações</div>
                    ) : (
                        <div className="p-6 sm:p-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center mb-10 text-slate-400">
                                <span className="material-icons-round cursor-pointer hover:text-primary p-2.5 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">settings</span>
                                <span className="material-icons-round cursor-pointer hover:text-primary p-2.5 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">bookmark_border</span>
                            </div>

                            <div className="flex flex-col items-center mb-10 text-center">
                                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[2.5rem] border-[6px] border-white shadow-2xl relative mb-6 group">
                                    {selectedContact.profile_pic ? (
                                        <img src={selectedContact.profile_pic} className="w-full h-full object-cover rounded-[2rem]" alt="" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-100 rounded-[2rem] flex items-center justify-center text-4xl font-black text-slate-300 shadow-inner">{selectedContact.name?.charAt(0)}</div>
                                    )}
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary border-4 border-white rounded-2xl flex items-center justify-center text-white shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all group-hover:rotate-12">
                                        <span className="material-icons-round text-lg">edit</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 leading-tight">{selectedContact.name}</h3>
                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200/50">
                                    <span className="material-icons-round text-xs text-slate-400">phone</span>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedContact.remote_jid.split('@')[0]}</p>
                                </div>

                                <div className="mt-8 w-full p-1.5 bg-white/60 rounded-3xl border border-white shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary/20 hover:bg-white transition-all">
                                    <div className="flex items-center gap-3 p-2.5">
                                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"></div>
                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Equipe Geral</span>
                                    </div>
                                    <span className="material-icons-round text-slate-300 group-hover:text-primary transition-all mr-2">expand_more</span>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex gap-8 border-b border-slate-200/60 mb-8 pb-3 text-[11px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar">
                                    <button className="text-primary border-b-2 border-primary pb-3 whitespace-nowrap">Histórico</button>
                                    <button className="text-slate-400 hover:text-slate-600 whitespace-nowrap transition-colors">Notas (0)</button>
                                    <button className="text-slate-400 hover:text-slate-600 whitespace-nowrap transition-colors">Tarefas</button>
                                </div>
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Atividades Recentes</p>
                                    {[
                                        { icon: 'forum', color: 'indigo', title: 'Atendimento Iniciado', sub: 'Há 5 minutos' },
                                        { icon: 'history', color: 'slate', title: 'Status Alterado', sub: 'Por Sistema' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between group cursor-pointer bg-white/40 p-4 rounded-3xl border border-white/60 hover:bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl bg-${item.color}-500/10 text-${item.color}-500 flex items-center justify-center`}><span className="material-icons-round text-2xl">{item.icon}</span></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 leading-tight">{item.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.sub}</p>
                                                </div>
                                            </div>
                                            <span className="material-icons-round text-slate-200 group-hover:text-slate-400 transition-colors">chevron_right</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Contact Management Actions */}
                            <div className="mt-8 space-y-3">
                                <button
                                    onClick={toggleBlock}
                                    className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all border ${selectedContact.is_blocked ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-100'}`}
                                >
                                    <span className="material-icons-round text-lg">{selectedContact.is_blocked ? 'lock_open' : 'block'}</span>
                                    {selectedContact.is_blocked ? 'Desbloquear' : 'Bloquear Contato'}
                                </button>
                                <button
                                    onClick={deleteConversation}
                                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white hover:bg-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <span className="material-icons-round text-lg">delete_outline</span>
                                    Limpar Conversa
                                </button>
                            </div>

                            {/* PRO Card */}
                            <div className="mt-10 p-8 bg-gradient-to-br from-[#0055FF] to-[#00A3FF] rounded-[3rem] relative overflow-hidden group shadow-2xl shadow-blue-200 shrink-0 select-none">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-6 animate-bounce shadow-lg border border-white/20"><span className="material-icons-round text-2xl">rocket_launch</span></div>
                                    <h4 className="text-white font-black text-lg mb-2 leading-tight tracking-tight">Potencialize com PRO!</h4>
                                    <p className="text-white/70 text-[10px] mb-8 font-bold uppercase tracking-widest">Acesso ilimitado e IA Avançada</p>
                                    <button className="w-full py-4 bg-white text-primary rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10">Upgrade agora</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Modals --- */}

                {/* Agent Transfer Modal */}
                {transferModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Transfer Chat</h3>
                                <button onClick={() => setTransferModal(false)} className="w-10 h-10 hover:bg-slate-50 rounded-xl transition-all flex items-center justify-center text-slate-400"><span className="material-icons-round">close</span></button>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                                {agents.length === 0 ? (
                                    <div className="text-center py-10 opacity-30 italic font-medium text-slate-500">No agents online</div>
                                ) : (
                                    agents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => transferConversation(agent.id)}
                                            className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-black text-xl group-hover:bg-primary group-hover:text-white transition-all">{agent.name.charAt(0)}</div>
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800 leading-none mb-1">{agent.name}</p>
                                                <p className="text-[9px] uppercase font-black text-emerald-500 tracking-widest">Available</p>
                                            </div>
                                            <span className="material-icons-round text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* File Input (Hidden) */}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

                {/* Custom Scrollbar & Utility Styles */}
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                    
                    * {
                        font-family: 'Outfit', sans-serif !important;
                    }

                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }

                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(0, 0, 0, 0.05);
                        border-radius: 20px;
                    }

                    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                        background: rgba(0, 0, 0, 0.1);
                    }

                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }

                    textarea {
                        line-height: 1.5 !important;
                    }

                    .glass-effect {
                        background: rgba(255, 255, 255, 0.4);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.5);
                    }

                    @keyframes float {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-5px); }
                        100% { transform: translateY(0px); }
                    }

                    .animate-float {
                        animation: float 3s ease-in-out infinite;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default ChatView;
