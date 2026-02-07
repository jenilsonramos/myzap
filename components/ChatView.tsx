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
        <div className="h-full w-full flex bg-[#fbfbfc] text-slate-900 modern-chat overflow-hidden relative spring-motion">
            {/* Signature Overlay - High Priority noise */}
            <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.08] mix-blend-overlay signature-material-overlay"></div>

            {/* Signature Watermark */}
            <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none opacity-20">
                <span className="industrial-mono text-[8px] font-black uppercase tracking-[0.4em] text-slate-900">Signature UI v2.0 Elite</span>
            </div>

            {/* Sidebar de Contatos (Minimalista Industrial) */}
            <div className={`
                ${isSidebarCollapsed ? 'w-20' : 'w-80'} 
                border-r border-slate-200/50 flex flex-col bg-white transition-all duration-300 ease-in-out
            `}>
                {/* Header da Sidebar */}
                <div className="p-6 flex items-center justify-between">
                    {!isSidebarCollapsed && <h2 className="text-xl font-bold tracking-tight text-slate-800">Mensagens</h2>}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-all spring-motion active-scale-spring"
                    >
                        <span className="material-icons-round text-xl">
                            {isSidebarCollapsed ? 'menu_open' : 'menu'}
                        </span>
                    </button>
                </div>

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
                                w-full bg-slate-50 border border-slate-200/60 py-2.5 rounded-lg outline-none text-sm transition-all
                                ${isSidebarCollapsed ? 'px-0 text-center placeholder:opacity-0' : 'pl-10 pr-4 focus:ring-2 focus:ring-slate-100 focus:bg-white'}
                            `}
                        />
                    </div>
                </div>

                {/* Lista de Contatos */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-1 pb-4">
                    {filteredContacts.map(c => (
                        <div
                            key={c.id}
                            onClick={() => {
                                setSelectedContact(c);
                                fetchMessages(c.id);
                                markAsRead(c.id);
                            }}
                            className={`
                                group flex items-center p-3 rounded-xl cursor-pointer transition-all relative
                                ${selectedContact?.id === c.id ? 'bg-slate-100 shadow-sm' : 'hover:bg-slate-50'}
                            `}
                        >
                            <div className="relative shrink-0">
                                <div className={`w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-industrial-sm avatar-ring ${getStatusColor(c.status) === 'bg-emerald-500' ? 'avatar-ring-active' : ''}`}>
                                    {c.profile_pic ? (
                                        <img src={c.profile_pic} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        c.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(c.status)}`}></div>
                            </div>

                            {!isSidebarCollapsed && (
                                <div className="flex-1 min-w-0 ml-3">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className={`text-sm font-semibold truncate ${selectedContact?.id === c.id ? 'text-slate-900' : 'text-slate-700'}`}>{c.name}</h3>
                                        {c.lastTime && <span className="text-[10px] text-slate-400 industrial-mono">{formatFriendlyDate(c.lastTime)}</span>}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] text-slate-500 truncate">{c.lastMessage || '...'}</p>
                                        {c.unread_count > 0 && (
                                            <span className="h-4 min-w-[16px] px-1 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                                {c.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Janela de Chat Principal */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-40 select-none bg-slate-50/30">
                        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                            <span className="material-icons-round text-4xl text-slate-300">chat_bubble_outline</span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-800">Selecione uma conversa</h2>
                        <p className="text-sm text-slate-400 mt-2">Escolha alguém para começar a conversar</p>
                    </div>
                ) : (
                    <>
                        {/* Header do Chat */}
                        <div className="h-16 px-6 border-b border-slate-200/50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shadow-industrial-sm avatar-ring-active">
                                    {selectedContact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-slate-800 truncate">{selectedContact.name}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedContact.status)} animate-pulse-soft shadow-[0_0_8px_rgba(34,197,94,0.4)]`}></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest industrial-mono">online</span>
                                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping ml-2" title="Signature Active v2"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => updateStatus(selectedContact.id, 'closed')}
                                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-all group spring-motion active-scale-spring"
                                    title="Finalizar Conversa"
                                >
                                    <span className="material-icons-round text-xl">check_circle</span>
                                </button>
                                <button
                                    onClick={() => { fetchAgents(); setTransferModal(true); }}
                                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all spring-motion active-scale-spring"
                                    title="Transferir"
                                >
                                    <span className="material-icons-round text-xl">ios_share</span>
                                </button>
                                <button
                                    onClick={toggleAI}
                                    className={`p-2 rounded-lg transition-all spring-motion active-scale-spring ${selectedContact.ai_paused ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-50 hover:text-blue-500'}`}
                                    title={selectedContact.ai_paused ? "Ativar IA" : "Pausar IA"}
                                >
                                    <span className="material-icons-round text-xl">{selectedContact.ai_paused ? 'smart_toy' : 'auto_awesome'}</span>
                                </button>
                                <button
                                    onClick={() => setShowContactInfo(!showContactInfo)}
                                    className={`p-2 rounded-lg transition-all spring-motion active-scale-spring ${showContactInfo ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    <span className="material-icons-round text-xl">info</span>
                                </button>
                            </div>
                        </div>

                        {/* Área de Mensagens */}
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 bg-[#f8f9fa] custom-scrollbar">
                            {messages.map((msg, index) => {
                                const isMe = msg.key_from_me;
                                const { content, type, mediaUrl } = getMessageContent(msg);

                                // Signature Grouping Logic
                                const prevMsg = messages[index - 1];
                                const nextMsg = messages[index + 1];
                                const isSameAsPrev = prevMsg && prevMsg.key_from_me === msg.key_from_me;
                                const isSameAsNext = nextMsg && nextMsg.key_from_me === msg.key_from_me;

                                let groupClass = "";
                                if (isSameAsPrev && isSameAsNext) groupClass = "msg-group-mid";
                                else if (isSameAsPrev) groupClass = "msg-group-last";
                                else if (isSameAsNext) groupClass = "msg-group-first";

                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSameAsPrev ? 'mt-0.5' : 'mt-4'}`}>
                                        <div className={`
                                            max-w-[80%] p-1 rounded-2xl border glass-sheen spring-motion hover-scale-spring signature-bubble
                                            ${isMe ? 'border-slate-300 shadow-industrial-lg' : 'border-slate-200 shadow-industrial-md'}
                                            ${groupClass}
                                        `}>
                                            <div className="px-3 py-2">
                                                {type === 'image' && mediaUrl && (
                                                    <div className="rounded-xl overflow-hidden mb-2 border border-slate-100 bg-slate-50">
                                                        <img src={mediaUrl} className="max-h-72 w-full object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(mediaUrl, '_blank')} alt="" />
                                                    </div>
                                                )}
                                                {type === 'audio' && mediaUrl && (
                                                    <div className="min-w-[200px] py-1">
                                                        <audio src={mediaUrl} controls className="w-full h-8 opacity-70" />
                                                    </div>
                                                )}
                                                {type === 'document' && mediaUrl && (
                                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-1">
                                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                                                            <span className="material-icons-round">description</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <p className="text-xs font-semibold truncate text-slate-800">{content || 'Documento'}</p>
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold tabular-nums">ARQUIVO</p>
                                                        </div>
                                                        <a href={mediaUrl} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white rounded-md text-slate-400 transition-colors shadow-sm">
                                                            <span className="material-icons-round text-lg">download</span>
                                                        </a>
                                                    </div>
                                                )}
                                                {type === 'text' && content && (
                                                    <p className="text-[14px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{content}</p>
                                                )}

                                                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                                    {msg.source === 'ai' && <span className="text-[9px] font-black uppercase text-blue-600 tracking-tighter bg-blue-50 px-1.5 rounded-md skeleton-shimmer">IA</span>}
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase industrial-mono">
                                                        {new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMe && (
                                                        <span className={`material-icons-round text-sm ${msg.status === 'read' ? 'text-blue-500' : 'text-slate-300'}`}>
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

                        {/* Input de Mensagem */}
                        <div className="p-4 border-t border-slate-200/50 bg-white shrink-0">
                            {isRecording ? (
                                <div className="max-w-5xl mx-auto bg-slate-900 text-white rounded-[2rem] p-4 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-500 ease-out shadow-industrial-lg relative overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30"></div>
                                    <div className="flex items-center gap-5 relative z-10">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/10">
                                            <div className="waveform-bar"></div>
                                            <div className="waveform-bar"></div>
                                            <div className="waveform-bar"></div>
                                            <div className="waveform-bar"></div>
                                            <div className="waveform-bar"></div>
                                        </div>
                                        <span className="font-bold tabular-nums text-xl industrial-mono tracking-tighter">
                                            {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                                            {(recordingTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="flex gap-3 relative z-10">
                                        <button onClick={() => stopRecording(false)} className="px-5 py-2.5 hover:bg-white/10 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest text-white/60 hover:text-white">Descartar</button>
                                        <button onClick={() => stopRecording(true)} className="px-8 py-2.5 bg-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/40 active:scale-95 transition-all text-white border border-white/20">Enviar Áudio</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-5xl mx-auto border border-slate-200/80 rounded-[2rem] bg-slate-50 flex items-end p-2 transition-all input-sheen-focus shadow-industrial-lg spring-motion">
                                    <div className="flex gap-1 mb-1">
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="p-3 hover:bg-white hover:shadow-sm rounded-2xl text-slate-400 hover:text-slate-600 transition-all spring-motion active-scale-spring"
                                        >
                                            <span className="material-icons-round text-xl">sentiment_satisfied_alt</span>
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-3 hover:bg-white hover:shadow-sm rounded-2xl text-slate-400 hover:text-slate-600 transition-all spring-motion active-scale-spring"
                                        >
                                            <span className="material-icons-round text-xl">attach_file</span>
                                        </button>
                                    </div>
                                    <textarea
                                        rows={1}
                                        value={newMessage}
                                        onChange={(e) => {
                                            setNewMessage(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Escrever mensagem..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 px-4 custom-scrollbar font-medium text-slate-700 min-h-[52px] resize-none"
                                    />
                                    <div className="flex gap-2 mb-1 mr-1">
                                        <button
                                            onClick={startRecording}
                                            className="p-3 hover:bg-white hover:shadow-sm rounded-2xl text-slate-400 hover:text-blue-500 transition-all spring-motion active-scale-spring"
                                        >
                                            <span className="material-icons-round text-xl">mic</span>
                                        </button>
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!newMessage.trim()}
                                            className={`
                                                p-3 rounded-2xl transition-all spring-motion active-scale-spring
                                                ${newMessage.trim()
                                                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 border border-white/10 translate-y-[-1px]'
                                                    : 'text-slate-200 bg-slate-100/50'}
                                            `}
                                        >
                                            <span className="material-icons-round text-xl">send</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            {showEmojiPicker && (
                                <div className="absolute bottom-24 left-10 z-50 animate-in zoom-in-95 duration-200">
                                    <EmojiPicker onEmojiClick={(emoji: EmojiClickData) => setNewMessage(p => p + emoji.emoji)} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Painel de Informações do Contato (Retrátil) */}
            {showContactInfo && selectedContact && (
                <div className="w-80 border-l border-slate-200/50 bg-white flex flex-col animate-in slide-in-from-right duration-500 ease-out shadow-industrial-lg">
                    <div className="p-6 border-b border-slate-200/50 flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">Detalhes</h4>
                        <button onClick={() => setShowContactInfo(false)} className="text-slate-400 hover:text-slate-600"><span className="material-icons-round">close</span></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-3xl bg-slate-100 mb-4 border-2 border-slate-50 shadow-industrial-md overflow-hidden avatar-ring-active relative">
                                {selectedContact.profile_pic ? (
                                    <img src={selectedContact.profile_pic} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-300 bg-gradient-to-br from-slate-50 to-slate-200">{selectedContact.name?.charAt(0)}</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none"></div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{selectedContact.name}</h3>
                            <p className="text-[11px] text-slate-400 industrial-mono mt-1">{selectedContact.remote_jid.split('@')[0]}</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Informações Adicionais</p>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase">Status</span>
                                    <span className={`text-[10px] font-black uppercase text-white px-2 py-0.5 rounded-md industrial-mono ${getStatusColor(selectedContact.status)}`}>{selectedContact.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase">IA</span>
                                    <span className={`text-[11px] font-bold industrial-mono ${selectedContact.ai_paused ? 'text-amber-500' : 'text-emerald-500'}`}>{selectedContact.ai_paused ? 'Pausada' : 'Ativa'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/50 space-y-3">
                            <button
                                onClick={toggleBlock}
                                className={`w-full py-3 rounded-xl text-xs font-bold uppercase border transition-all ${selectedContact.is_blocked ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}
                            >
                                {selectedContact.is_blocked ? 'Desbloquear' : 'Bloquear'}
                            </button>
                            <button
                                onClick={deleteConversation}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase shadow-lg shadow-slate-200"
                            >
                                Limpar Conversa
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

                /* Profundidade Industrial (Z-Index Shadows) */
                .shadow-industrial-sm {
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.04);
                }
                .shadow-industrial-md {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255,255,255,0.6);
                }
                .shadow-industrial-lg {
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255,255,255,0.8);
                }

                /* Efeito de Reflexo (Sheen) */
                .glass-sheen {
                    position: relative;
                    overflow: hidden;
                }
                .glass-sheen::after {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 50%;
                    background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
                    pointer-events: none;
                }
                
                /* Materialidade: Signature Noise Overlay */
                .signature-material-overlay {
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Cfilter id='noiseFilter'%3%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3%3C/filter%3%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3%3C/svg%3");
                }

                /* Signature Spring Motion */
                .spring-motion {
                    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .hover-scale-spring:hover {
                    transform: scale(1.02);
                }
                .active-scale-spring:active {
                    transform: scale(0.97);
                }

                /* Message Grouping Dynamics - Rounded & Border Polishing */
                .msg-group-first { 
                    border-bottom-left-radius: 6px !important; 
                    border-bottom-right-radius: 6px !important; 
                    margin-bottom: 3px !important; 
                }
                .msg-group-mid { 
                    border-radius: 6px !important; 
                    margin-bottom: 3px !important; 
                    margin-top: 3px !important;
                }
                .msg-group-last { 
                    border-top-left-radius: 6px !important; 
                    border-top-right-radius: 6px !important; 
                    margin-top: 3px !important; 
                }
                
                /* Signature Glass Bubbles */
                .signature-bubble {
                    background: linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.95) 100%) !important;
                    backdrop-filter: blur(8px);
                }
                
                /* Skeleton Shimmer Elite */
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .skeleton-shimmer {
                    background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
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

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.08);
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.15);
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
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
