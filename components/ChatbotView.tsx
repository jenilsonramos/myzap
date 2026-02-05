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
}

const ChatbotView: React.FC = () => {
    const [chatbot, setChatbot] = useState<Chatbot | null>(null);
    const [rules, setRules] = useState<ChatbotRule[]>([]);
    const [instances, setInstances] = useState<string[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<string>('');
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
                setInstances(data.map((i: any) => i.business_name));
            }

            // Buscar chatbot
            const chatRes = await fetch('/api/chatbot/keywords', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (chatRes.ok) {
                const data = await chatRes.json();
                setChatbot(data.chatbot);
                setRules(data.rules || []);
                if (data.chatbot?.instance_name) {
                    setSelectedInstance(data.chatbot.instance_name);
                }
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
            await fetch('/api/chatbot/keywords', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    instance_name: selectedInstance || null,
                    rules: rules.map((r, i) => ({ ...r, response_order: i }))
                })
            });
            await fetchData();
            alert('Chatbot salvo com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar chatbot');
        } finally {
            setSaving(false);
        }
    };

    const toggleChatbot = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/chatbot/keywords/toggle', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !chatbot?.is_active })
            });
            const data = await res.json();
            if (data.flowsDisabled) {
                alert('FlowBuild foi pausado automaticamente enquanto o Chatbot está ativo.');
            }
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <span className="material-icons-round text-white text-2xl">smart_toy</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold dark:text-white">Chatbot por Palavras-chave</h2>
                            <p className="text-slate-500 text-sm">Respostas automáticas baseadas em palavras-chave</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleChatbot}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${chatbot?.is_active
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            }`}
                    >
                        {chatbot?.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                </div>

                {chatbot?.is_active && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
                        <span className="material-icons-round text-amber-500">warning</span>
                        <p className="text-amber-700 dark:text-amber-400 text-sm">
                            <strong>Atenção:</strong> O FlowBuild está pausado enquanto o Chatbot está ativo.
                        </p>
                    </div>
                )}
            </div>

            {/* Configuração */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <h3 className="font-bold text-lg mb-4 dark:text-white">Configuração</h3>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-500 mb-2">Instância (deixe vazio para todas)</label>
                    <select
                        value={selectedInstance}
                        onChange={(e) => setSelectedInstance(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 border-none focus:ring-2 focus:ring-primary outline-none"
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
                        <p>Nenhuma regra configurada</p>
                        <p className="text-sm">Clique em "Adicionar Regra" para começar</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {rules.map((rule, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                                        Regra {index + 1}
                                    </span>
                                    <button
                                        onClick={() => removeRule(index)}
                                        className="w-8 h-8 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center transition-all"
                                    >
                                        <span className="material-icons-round text-sm">delete</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Match</label>
                                        <select
                                            value={rule.match_type}
                                            onChange={(e) => updateRule(index, 'match_type', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="starts">Começa com</option>
                                            <option value="contains">Contém</option>
                                            <option value="ends">Termina com</option>
                                            <option value="any">Qualquer mensagem</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Palavra-chave</label>
                                        <input
                                            type="text"
                                            value={rule.keyword}
                                            onChange={(e) => updateRule(index, 'keyword', e.target.value)}
                                            placeholder={rule.match_type === 'any' ? '(não aplicável)' : 'Digite a palavra...'}
                                            disabled={rule.match_type === 'any'}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Mensagem de Resposta</label>
                                    <textarea
                                        value={rule.message_content}
                                        onChange={(e) => updateRule(index, 'message_content', e.target.value)}
                                        placeholder="Digite a resposta que será enviada..."
                                        rows={3}
                                        className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary outline-none resize-none"
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Delay (segundos)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="60"
                                            value={rule.delay_seconds}
                                            onChange={(e) => updateRule(index, 'delay_seconds', parseInt(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Botão Salvar */}
            <button
                onClick={saveChatbot}
                disabled={saving}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Salvando...
                    </>
                ) : (
                    <>
                        <span className="material-icons-round">save</span>
                        Salvar Chatbot
                    </>
                )}
            </button>
        </div>
    );
};

export default ChatbotView;
