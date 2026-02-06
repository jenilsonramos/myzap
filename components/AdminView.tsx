import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import { emailTemplates } from '../lib/EmailTemplates';

const AdminView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'payments' | 'emails' | 'analytics' | 'system'>('analytics');
    const [dbTemplates, setDbTemplates] = useState<any[]>([]);
    const [previewEmail, setPreviewEmail] = useState<keyof typeof emailTemplates | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [settings, setSettings] = useState({
        evolution_url: '',
        evolution_apikey: '',
        stripe_public_key: '',
        stripe_secret_key: '',
        stripe_webhook_secret: '',
        smtp_host: 'smtp.zeptomail.com',
        smtp_port: '587',
        smtp_user: '',
        smtp_pass: '',
        smtp_from_email: '',
        smtp_from_name: '',
        smtp_test_email: '',
        require_email_activation: 'false'
    });
    const [loadingSettings, setLoadingSettings] = useState(true);

    const [revenueStats, setRevenueStats] = useState({
        mrr: 0,
        newSubscriptions: 0,
        activePayingUsers: 0,
        churnRate: '0',
        ltv: '0',
        monthlyData: [] as { month: string; revenue: number; users: number }[],
        topPlans: [] as { name: string; subscribers: number; revenue: number; percentage: string }[],
        recentPayments: [] as { name: string; plan: string; amount: number; date: string; status: string }[]
    });
    const [loadingRevenue, setLoadingRevenue] = useState(true);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) {
                setSettings({
                    evolution_url: data.evolution_url || '',
                    evolution_apikey: data.evolution_apikey || '',
                    stripe_public_key: data.stripe_public_key || '',
                    stripe_secret_key: data.stripe_secret_key || '',
                    stripe_webhook_secret: data.stripe_webhook_secret || '',
                    smtp_host: data.smtp_host || 'smtp.zeptomail.com',
                    smtp_port: data.smtp_port || '587',
                    smtp_user: data.smtp_user || '',
                    smtp_pass: data.smtp_pass || '',
                    smtp_from_email: data.smtp_from_email || '',
                    smtp_from_name: data.smtp_from_name || '',
                    smtp_test_email: '',
                    require_email_activation: data.require_email_activation || 'false'
                });
                fetchEmailTemplates();
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    const fetchEmailTemplates = async () => {
        try {
            const response = await fetch('/api/admin/email-templates', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) setDbTemplates(data);
        } catch (err) { }
    };

    const saveEmailTemplate = async (tpl: any) => {
        try {
            const response = await fetch('/api/admin/email-templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify(tpl)
            });
            if (response.ok) showToast('Template atualizado!', 'success');
        } catch (err) {
            showToast('Erro ao salvar template', 'error');
        }
    };

    const fetchRevenueStats = async () => {
        try {
            setLoadingRevenue(true);
            const response = await fetch('/api/admin/revenue-stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) setRevenueStats(data);
        } catch (err) {
            console.error('Error fetching revenue stats:', err);
        } finally {
            setLoadingRevenue(false);
        }
    };

    const saveSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                showToast('Configurações salvas!', 'success');
            }
        } catch (err) {
            showToast('Erro ao salvar', 'error');
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchRevenueStats();
    }, []);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Admin Tabs */}
            <div className="flex flex-wrap items-center gap-3 p-2 bg-white dark:bg-card-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm w-fit">
                {[
                    { id: 'analytics', label: 'Financeiro', icon: 'insights' },
                    { id: 'users', label: 'Usuários', icon: 'people' },
                    { id: 'plans', label: 'Planos', icon: 'subscriptions' },
                    { id: 'payments', label: 'Pagamentos', icon: 'payments' },
                    { id: 'emails', label: 'Modelos de E-mail', icon: 'mail' },
                    { id: 'system', label: 'Sistema & API', icon: 'settings_suggest' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-icons-round text-lg">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-card-dark rounded-huge border border-slate-100 dark:border-white/5 shadow-2xl min-h-[600px] overflow-hidden">

                {activeTab === 'analytics' && (
                    <div className="p-8 space-y-10 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Insights de Receita</h3>
                                <p className="text-slate-500 text-sm font-medium">Desempenho financeiro da plataforma</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'MRR Atual', val: `R$ ${revenueStats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: `${revenueStats.activePayingUsers} assinantes ativos`, color: 'text-indigo-600' },
                                { label: 'Novas Assinaturas', val: String(revenueStats.newSubscriptions), sub: 'Este mês', color: 'text-emerald-500' },
                                { label: 'LTV Estimado', val: `R$ ${parseFloat(revenueStats.ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'Baseado em dados reais', color: 'text-primary' },
                                { label: 'Taxa de Churn', val: `${revenueStats.churnRate}%`, sub: 'Atenção requerida', color: 'text-rose-500' },
                            ].map((stat, i) => (
                                <div key={i} className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h4 className={`text-2xl font-black ${stat.color} mb-1`}>{stat.val}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{stat.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'emails' && (
                    <div className="p-8 space-y-10 animate-in fade-in duration-500">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
                                <span className="material-icons-round text-white text-3xl">mail_lock</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Modelos de E-mail</h3>
                                <p className="text-slate-500 text-sm font-medium">Personalize a comunicação premium com seus clientes</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {dbTemplates.map((tpl) => (
                                <div key={tpl.id} className="bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 rounded-huge p-8 shadow-xl space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                <span className="material-icons-round text-slate-500 text-sm">edit_note</span>
                                            </div>
                                            <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">{tpl.template_key.replace('_', ' ')}</h4>
                                        </div>
                                        <button
                                            onClick={() => saveEmailTemplate(tpl)}
                                            className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
                                        >
                                            <span className="material-icons-round text-xs">save</span>
                                            Salvar Alterações
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assunto do E-mail</label>
                                            <input
                                                value={tpl.subject}
                                                onChange={e => {
                                                    const newTpls = [...dbTemplates];
                                                    const idx = newTpls.findIndex(t => t.id === tpl.id);
                                                    newTpls[idx].subject = e.target.value;
                                                    setDbTemplates(newTpls);
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corpo HTML (Dica: Use {"{{name}}"} para o nome do usuário)</label>
                                            <textarea
                                                value={tpl.body_html}
                                                onChange={e => {
                                                    const newTpls = [...dbTemplates];
                                                    const idx = newTpls.findIndex(t => t.id === tpl.id);
                                                    newTpls[idx].body_html = e.target.value;
                                                    setDbTemplates(newTpls);
                                                }}
                                                rows={6}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <SystemSettingsTab settings={settings} setSettings={setSettings} saveSettings={saveSettings} loading={loadingSettings} />
                )}
            </div>
        </div>
    );
};

const SystemSettingsTab: React.FC<{
    settings: any,
    setSettings: (s: any) => void,
    saveSettings: () => Promise<void>,
    loading: boolean
}> = ({ settings, setSettings, saveSettings, loading }) => {

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Configurações...</div>;

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl">
                    <span className="material-icons-round text-white text-3xl">settings_suggest</span>
                </div>
                <div>
                    <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Configurações Base</h3>
                    <p className="text-slate-500 text-sm font-medium">Parâmetros globais de funcionamento do core MyZap</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-indigo-950/10 border border-indigo-500/10 rounded-huge p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3">
                        <span className="material-icons-round text-primary">hub</span>
                        <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Integração Evolution API</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL da API (Ex: https://api.exemplo.com)</label>
                            <input
                                value={settings.evolution_url}
                                onChange={e => setSettings({ ...settings, evolution_url: e.target.value })}
                                type="text"
                                placeholder="https://app-evolution.ublochat.com.br"
                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global ApiKey</label>
                            <input
                                value={settings.evolution_apikey}
                                onChange={e => setSettings({ ...settings, evolution_apikey: e.target.value })}
                                type="password"
                                placeholder="4296069E-..."
                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-huge p-8 space-y-4 border border-slate-100 dark:border-white/5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações de Status</h4>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-white/5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Versão do Core</span>
                            <span className="text-xs font-black dark:text-white">v1.2.0-stable</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-white/5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Banco de Dados</span>
                            <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                Conectado (MySQL)
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-white/5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Fuso Horário</span>
                            <span className="text-xs font-black dark:text-white">America/Sao_Paulo</span>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={saveSettings}
                className="bg-primary text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-3"
            >
                <span className="material-icons-round">cloud_done</span>
                Salvar Configurações Globais
            </button>
        </div>
    );
};

export default AdminView;
