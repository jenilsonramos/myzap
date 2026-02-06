
import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

interface Contact {
    id: number;
    phone: string;
    name: string;
    avatar: string;
    lastSeen: string;
    status: string;
    unread_count: number;
    instance_name: string;
    created_at: string;
    groups: string[];
}

const ContactsView: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { showToast } = useToast();

    // Edit Modal State
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [newName, setNewName] = useState('');

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/contacts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data);
            }
        } catch (error) {
            console.error('Erro ao buscar contatos:', error);
            showToast('Erro ao carregar contatos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleSaveEdit = async () => {
        if (!editingContact) return;
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/contacts/${editingContact.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });

            if (res.ok) {
                showToast('Contato atualizado com sucesso!', 'success');
                setEditingContact(null);
                fetchContacts(); // Refresh list
            } else {
                showToast('Erro ao atualizar contato', 'error');
            }
        } catch (err) {
            showToast('Erro ao conectar com servidor', 'error');
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Data desconhecida';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    const filteredContacts = contacts.filter(c =>
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm))
    );

    return (
        <div className="flex flex-col gap-6 animate-fadeIn h-full relative">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Agenda de Contatos</h2>
                    <p className="text-slate-500 font-medium">Gerencie seus clientes e leads capturados automaticamente.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Nome ou telefone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-3 bg-white dark:bg-card-dark rounded-2xl shadow-lg border border-white/20 focus:ring-2 focus:ring-primary outline-none min-w-[280px] transition-all"
                        />
                    </div>
                    <button onClick={fetchContacts} className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                        <span className="material-icons-round">refresh</span>
                        <span>Atualizar</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-6">
                    {filteredContacts.map((contact) => (
                        <div key={contact.id} className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20 hover:border-primary/30 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />

                            <div className="flex items-start justify-between mb-6 relative">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {contact.avatar ? (
                                            <img src={contact.avatar} alt={contact.name} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-slate-800" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl">👤</div>
                                        )}
                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${contact.status === 'open' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1" title={contact.name}>{contact.name || 'Sem nome'}</h3>
                                        <p className="text-sm text-slate-500 font-medium">{contact.phone?.split('@')[0]}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setEditingContact(contact); setNewName(contact.name || ''); }}
                                    className="material-icons-round text-slate-400 hover:text-primary transition-colors bg-slate-50 dark:bg-slate-800 p-2 rounded-xl"
                                >
                                    edit
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6 relative">
                                {/* Instance Badge */}
                                {contact.instance_name && (
                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-icons-round text-[10px]">smartphone</span>
                                        {contact.instance_name}
                                    </span>
                                )}
                                {/* Groups */}
                                {(contact.groups || []).map((group, idx) => (
                                    <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider">
                                        {group}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                                <div className="flex items-center gap-2" title={`Cadastrado em: ${formatDate(contact.created_at)}`}>
                                    <span className="material-icons-round text-slate-400 text-sm">event</span>
                                    <span className="text-xs text-slate-500">
                                        {formatDate(contact.created_at)}
                                    </span>
                                </div>
                                {/* Future: Link to chat */}
                                <div className="flex items-center gap-1.5 text-primary text-xs font-bold opacity-50 cursor-not-allowed">
                                    <span>CONVERSA</span>
                                    <span className="material-icons-round text-sm">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingContact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-card-dark rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scaleIn border border-white/20">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Editar Contato</h3>
                            <button onClick={() => setEditingContact(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome do Contato</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 focus:border-primary outline-none font-bold text-slate-700 dark:text-slate-200 transition-all"
                                    placeholder="Digite o nome..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setEditingContact(null)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactsView;
