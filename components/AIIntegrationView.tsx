import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const AIIntegrationView: React.FC = () => {
    const { showToast } = useToast();
    const [selectedProvider, setSelectedProvider] = useState<'openai' | 'google'>('openai');
    const [aiSettings, setAiSettings] = useState({
        openai_key: '',
        openai_model: 'gpt-4o',
        google_key: '',
        google_model: 'gemini-1.5-pro',
        system_prompt: 'Você é um assistente virtual ultra-eficiente do MyZap. Seja cordial, direto e ajude o cliente a resolver suas dúvidas rapidamente.',
        temperature: 0.7,
        max_tokens: 1000,
        ai_active: false
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('myzap_token');
                if (!token) return;

                const res = await fetch('/api/settings/ai', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAiSettings(prev => ({
                        ...prev,
                        ...data,
                        temperature: data.temperature ? parseFloat(data.temperature) : 0.7,
                        max_tokens: data.max_tokens ? parseInt(data.max_tokens) : 1000
                    }));
                }
            } catch (error) {
                console.error('Erro ao carregar configs de IA:', error);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/settings/ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(aiSettings)
            });

            if (res.ok) {
                showToast('Configurações de IA salvas com sucesso!', 'success');
            } else {
                showToast('Erro ao salvar configurações', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const providers = [
        { id: 'openai', name: 'OpenAI (GPT)', icon: 'auto_awesome', color: 'from-slate-800 to-slate-900', textColor: 'text-slate-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
        {
            id: 'google',
            name: 'Google Gemini',
            icon: 'temp_grow',
            color: 'from-blue-600 to-indigo-700',
            textColor: 'text-blue-50',
            // Using a reliable Google logo or Gemini Sparkle Base64 if possible. For now, using a standard Google Cloud/Gemini related icon or just a text fallback if image fails, but here uses a solid Wikipedia SVG for Google Gemini or similar.
            logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg'
        }
    ];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Provider Selection Cards */}
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <span className="material-icons-round text-2xl">smart_toy</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-tight">Resposta Automática Inteligente</h3>
                        <p className="text-emerald-700/80 dark:text-emerald-500/80 text-sm font-medium">A IA responderá a todas as mensagens recebidas.</p>
                    </div>
                </div>
                <div className="relative">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!aiSettings.ai_active}
                            onChange={(e) => {
                                const newValue = e.target.checked;
                                if (newValue) {
                                    // Show warning before enabling
                                    if (confirm("⚠️ ATENÇÃO: Ao ativar a IA, todos os outros Chatbots e Fluxos serão DESATIVADOS automaticamente para evitar conflitos. Deseja continuar?")) {
                                        setAiSettings({ ...aiSettings, ai_active: true });
                                    }
                                } else {
                                    setAiSettings({ ...aiSettings, ai_active: false });
                                }
                            }}
                        />
                        <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {providers.map((provider) => (
                    <button
                        key={provider.id}
                        onClick={() => setSelectedProvider(provider.id as any)}
                        className={`relative overflow-hidden rounded-huge p-8 border-2 transition-all text-left ${selectedProvider === provider.id
                            ? `bg-gradient-to-br ${provider.color} border-primary shadow-2xl`
                            : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/5 hover:border-primary/50'}`}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${selectedProvider === provider.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    <span className="material-icons-round text-3xl">{provider.icon}</span>
                                </div>
                                <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${selectedProvider === provider.id ? 'text-white' : 'dark:text-white'}`}>
                                    {provider.name}
                                </h3>
                                <p className={`text-sm font-medium opacity-80 ${selectedProvider === provider.id ? 'text-white/80' : 'text-slate-500'}`}>
                                    {provider.id === 'openai' ? 'Líder em raciocínio e modelos GPT-4.' : 'Performance multimodal e contexto gigante.'}
                                </p>
                            </div>
                            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl bg-white p-2 shadow-lg ${selectedProvider === provider.id ? 'opacity-100' : 'opacity-40'}`}>
                                <img src={provider.logo} alt={provider.name} className="w-full h-full object-contain" />
                            </div>
                        </div>
                        {selectedProvider === provider.id && (
                            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Configuration Form */}
            <div className="bg-white dark:bg-card-dark rounded-huge border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <span className="material-icons-round text-2xl">settings_input_component</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Cofre de Credenciais</h3>
                            <p className="text-slate-500 text-sm font-medium">Configure suas chaves com segurança</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {selectedProvider === 'openai' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">OpenAI API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="sk-..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none font-mono"
                                        value={aiSettings.openai_key}
                                        onChange={(e) => setAiSettings({ ...aiSettings, openai_key: e.target.value })}
                                    />
                                    <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">visibility</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Modelo GPT</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none appearance-none cursor-pointer"
                                    value={aiSettings.openai_model}
                                    onChange={(e) => setAiSettings({ ...aiSettings, openai_model: e.target.value })}
                                >
                                    <option value="gpt-4o">GPT-4o (Omni)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Google API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="AIza..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none font-mono"
                                        value={aiSettings.google_key}
                                        onChange={(e) => setAiSettings({ ...aiSettings, google_key: e.target.value })}
                                    />
                                    <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">visibility</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Modelo Gemini</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none appearance-none cursor-pointer"
                                    value={aiSettings.google_model}
                                    onChange={(e) => setAiSettings({ ...aiSettings, google_model: e.target.value })}
                                >
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="gemini-pro">Gemini 1.0 Pro</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Prompt de Sistema (Persona do Bot)</label>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:underline">Dicas de Engenharia de Prompt</span>
                        </div>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-3xl px-6 py-5 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none min-h-[160px] leading-relaxed resize-none"
                            placeholder="Descreva a personalidade e as regras do seu bot..."
                            value={aiSettings.system_prompt}
                            onChange={(e) => setAiSettings({ ...aiSettings, system_prompt: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Temperatura ({aiSettings.temperature})</label>
                                <span className="text-[10px] text-slate-400 font-bold italic">{aiSettings.temperature > 0.8 ? 'Criativo' : aiSettings.temperature < 0.4 ? 'Preciso' : 'Equilibrado'}</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.1"
                                className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                value={aiSettings.temperature}
                                onChange={(e) => setAiSettings({ ...aiSettings, temperature: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Máximo de Tokens</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-3 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                                    value={aiSettings.max_tokens}
                                    onChange={(e) => setAiSettings({ ...aiSettings, max_tokens: parseInt(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400 font-black uppercase whitespace-nowrap">Tokens p/ resposta</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-icons-round text-lg">shield</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Encriptado ponta-a-ponta</span>
                    </div>
                    <button
                        onClick={handleSave}
                        className="px-10 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-icons-round">save</span>
                        Salvar Configuração de IA
                    </button>
                </div>
            </div>

            {/* AI Stats / Usage Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark rounded-huge p-6 border border-slate-100 dark:border-white/5 shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                        <span className="material-icons-round">generating_tokens</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Consumo Total</p>
                        <p className="text-xl font-black dark:text-white mt-1">124.5k Tokens</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-card-dark rounded-huge p-6 border border-slate-100 dark:border-white/5 shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
                        <span className="material-icons-round">speed</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Latência Média</p>
                        <p className="text-xl font-black dark:text-white mt-1">1.2s / resp</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-card-dark rounded-huge p-6 border border-slate-100 dark:border-white/5 shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner">
                        <span className="material-icons-round">quiz</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Taxa de Sucesso</p>
                        <p className="text-xl font-black dark:text-white mt-1">99.8%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIIntegrationView;
