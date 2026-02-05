import React, { useState, useEffect } from 'react';

interface ChatbotRule {
    id?: number;
    match_type: 'starts' | 'contains' | 'ends' | 'any';
    keyword: string;
    response_order: number;
    message_content: string;
    delay_seconds: number;
}

interface Chatbot {
    id: number;
    instance_name: string;
    is_active: boolean;
    rules: ChatbotRule[];
}

const ChatbotView: React.FC = () => {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [chatbots, setChatbots] = useState<Chatbot[]>([]);
    const [instances, setInstances] = useState<string[]>([]);

    // Editor State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedInstance, setSelectedInstance] = useState<string>('');
    const [rules, setRules] = useState<ChatbotRule[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('myzap_token');

            // Buscar instâncias
            const instRes = await fetch('/api/instances', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (instRes.ok) {
                const data = await instRes.json();
                setInstances(data.map((i: any) => i.business_name || i.name || i.instanceName));
            }

            // Buscar chatbots (lista)
            const chatRes = await fetch('/api/chatbot/keywords', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (chatRes.ok) {
                const data = await chatRes.json();
                setChatbots(data);
            }
        } catch (err) {
            console.error('Erro:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setSelectedInstance('');
        setRules([]);
        setView('editor');
    };

    const openEdit = (bot: Chatbot) => {
        setEditingId(bot.id);
        setSelectedInstance(bot.instance_name || '');
        setRules(bot.rules || []);
        setView('editor');
    };

    const addRule = () => {
        setRules([...rules, {
            match_type: 'contains',
            keyword: '',
            response_order: rules.length,
            message_content: '',
            delay_seconds: 0
        }]);
    };

    const updateRule = (index: number, field: keyof ChatbotRule, value: any) => {
        const updated = [...rules];
        (updated[index] as any)[field] = value;
        setRules(updated);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const saveChatbot = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/chatbot/keywords', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: editingId,
                    instance_name: selectedInstance || null,
                    rules: rules.map((r, i) => ({ ...r, response_order: i }))
                })
            });

            if (res.ok) {
                await fetchData();
                setView('list');
            }
        } catch (err) {
            console.error('Erro ao salvar:', err);
        } finally {
            setSaving(false);
        }
    };

    const deleteChatbot = async (id: number) => {
        if (!confirm('Deseja excluir este chatbot?')) return;
        try {
            const token = localStorage.getItem('myzap_token');
            await fetch(`/api/chatbot/keywords/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
        } catch (err) {
            console.error('Erro ao excluir:', err);
        }
    };

    const toggleChatbot = async (id: number, currentStatus: boolean) => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch(`/api/chatbot/keywords/${id}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            await fetchData();
        } catch (err) {
            console.error('Erro ao alternar:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (view === 'list') {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white">Meus Chatbots</h2>
                        <p className="text-slate-500 text-sm">Gerencie suas regras de resposta automática</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                        <span className="material-icons-round">add</span> Novo Chatbot
                    </button>
                </div>

                {chatbots.length === 0 ? (
                    <div className="bg-white dark:bg-card-dark rounded-3xl p-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5">
                        <span className="material-icons-round text-6xl text-slate-200 dark:text-white/10 mb-4">smart_toy</span>
                        <p className="text-slate-500 dark:text-slate-400 font-bold mb-6">Você ainda não tem chatbots cadastrados</p>
                        <button onClick={openCreate} className="text-primary font-bold hover:underline">Criar meu primeiro chatbot</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {chatbots.map(bot => (
                            <div key={bot.id} className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20 flex items-center justify-between group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bot.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <span className="material-icons-round">{bot.is_active ? 'bolt' : 'smart_toy'}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold dark:text-white">{bot.instance_name || 'Todas as instâncias'}</h4>
                                        <p className="text-xs text-slate-500">{bot.rules.length} regras configuradas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleChatbot(bot.id, bot.is_active)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${bot.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                                    >
                                        {bot.is_active ? 'Ativo' : 'Pausado'}
                                    </button>
                                    <button onClick={() => openEdit(bot)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-all flex items-center justify-center">
                                        <span className="material-icons-round text-sm">edit</span>
                                    </button>
                                    <button onClick={() => deleteChatbot(bot.id)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all flex items-center justify-center">
                                        <span className="material-icons-round text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header Editor */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-all flex items-center justify-center">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold dark:text-white">{editingId ? 'Editar Chatbot' : 'Novo Chatbot'}</h2>
                        <p className="text-slate-500 text-sm">Configure as palavras-chave e respostas</p>
                    </div>
                </div>
            </div>

            {/* Configuração */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <h3 className="font-bold text-lg mb-4 dark:text-white">Instância de Resposta</h3>
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-500 mb-2">Selecione para qual WhatsApp este chatbot responderá</label>
                    <select
                        value={selectedInstance}
                        onChange={(e) => setSelectedInstance(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                    >
                        <option value="">Todas as instâncias</option>
                        {instances.map(inst => (
                            <option key={inst} value={inst}>{inst}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Regras */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg dark:text-white">Regras de Resposta</h3>
                    <button
                        onClick={addRule}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all"
                    >
                        <span className="material-icons-round text-sm">add</span>
                        Adicionar Regra
                    </button>
                </div>

                {rules.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <span className="material-icons-round text-4xl mb-2">rule</span>
                        <p>Nenhuma regra configurada ainda</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {rules.map((rule, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-4 border border-transparent hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="bg-primary/10 text-primary text-[10px] font-black uppercase px-3 py-1 rounded-full">
                                        Regra #{index + 1}
                                    </span>
                                    <button
                                        onClick={() => removeRule(index)}
                                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                    >
                                        <span className="material-icons-round text-sm">delete</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Tipo de Match</label>
                                        <select
                                            value={rule.match_type}
                                            onChange={(e) => updateRule(index, 'match_type', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                                        >
                                            <option value="contains">Contém</option>
                                            <option value="starts">Começa com</option>
                                            <option value="ends">Termina com</option>
                                            <option value="any">Qualquer mensagem</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Palavra-chave</label>
                                        <input
                                            type="text"
                                            value={rule.keyword}
                                            onChange={(e) => updateRule(index, 'keyword', e.target.value)}
                                            placeholder={rule.match_type === 'any' ? '(Inativo)' : 'Ex: Olá, suporte...'}
                                            disabled={rule.match_type === 'any'}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Mensagem de Resposta</label>
                                    <textarea
                                        value={rule.message_content}
                                        onChange={(e) => updateRule(index, 'message_content', e.target.value)}
                                        placeholder="Digite a resposta automática..."
                                        rows={3}
                                        className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary outline-none resize-none dark:text-white"
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Delay (segundos)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="60"
                                            value={rule.delay_seconds}
                                            onChange={(e) => updateRule(index, 'delay_seconds', parseInt(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Botão Salvar Editor */}
            <div className="flex gap-4">
                <button
                    onClick={() => setView('list')}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={saveChatbot}
                    disabled={saving || rules.length === 0}
                    className="flex-[2] py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvando...
                        </>
                    ) : (
                        <>
                            <span className="material-icons-round">check_circle</span>
                            Confirmar e Salvar
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ChatbotView;
