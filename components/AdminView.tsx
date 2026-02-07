import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from './ToastContext';
import { emailTemplates } from '../lib/EmailTemplates';

const AdminView: React.FC = () => {
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'payments' | 'emails' | 'analytics' | 'system' | 'branding'>((searchParams.get('tab') as any) || 'analytics');
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
        require_email_activation: 'false',
        system_name: 'MyZap',
        primary_color: '#166534',
        logo_url: '',
        favicon_url: '',
        seo_title: '',
        seo_description: '',
        seo_keywords: ''
    });
    const [loadingSettings, setLoadingSettings] = useState(true);

    // Revenue Stats State
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
                    require_email_activation: data.require_email_activation || 'false',
                    system_name: data.system_name || 'MyZap',
                    primary_color: data.primary_color || '#166534',
                    logo_url: data.logo_url || '',
                    favicon_url: data.favicon_url || '',
                    seo_title: data.seo_title || '',
                    seo_description: data.seo_description || '',
                    seo_keywords: data.seo_keywords || ''
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
            if (response.ok) {
                setRevenueStats(data);
            }
        } catch (err) {
            console.error('Error fetching revenue stats:', err);
        } finally {
            setLoadingRevenue(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchRevenueStats();
    }, []);

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
                showToast('Configurações salvas com sucesso!', 'success');
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (err) {
            showToast('Erro ao salvar no banco de dados.', 'error');
        }
    };


    const FEATURE_OPTIONS = [
        { id: 'flow_builder', label: 'FlowBuilder', icon: 'account_tree' },
        { id: 'ia_agent', label: 'IA Agent Pro', icon: 'psychology' },
        { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
        { id: 'api', label: 'API de Integração', icon: 'api' },
        { id: 'support', label: 'Suporte Prioritário', icon: 'contact_support' },
        { id: 'white_label', label: 'White-label', icon: 'branding_watermark' },
        { id: 'nlp', label: 'NLP Avançado', icon: 'translate' },
        { id: 'analytics', label: 'Analytics Avançado', icon: 'bar_chart' }
    ];


    // Real Users State
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) setUsers(data);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    React.useEffect(() => {
        if (activeTab === 'users') fetchUsers();
    }, [activeTab]);

    const toggleUserStatus = async (user: any) => {
        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        try {
            const response = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({ ...user, status: newStatus })
            });
            if (response.ok) {
                showToast(`Usuário ${newStatus === 'active' ? 'ativado' : 'suspenso'}!`, 'success');
                fetchUsers();
            }
        } catch (err) {
            showToast('Erro ao atualizar status.', 'error');
        }
    };

    const handleDeleteUser = async (id: string | number) => {
        if (!confirm('Tem certeza que deseja excluir este usuário definitivamente?')) return;
        try {
            const response = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) {
                showToast('Usuário removido!', 'success');
                fetchUsers();
            }
        } catch (err) {
            showToast('Erro ao excluir usuário.', 'error');
        }
    };

    const handleImpersonate = async (user: any) => {
        if (!confirm(`Deseja realmente fazer login como ${user.name}?`)) return;
        try {
            const response = await fetch(`/api/admin/users/${user.id}/impersonate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('myzap_token', data.token);
                localStorage.setItem('myzap_user', JSON.stringify(data.user));
                // Force reload/redirect to dashboard
                window.location.href = '/analytics';
            } else {
                showToast('Erro ao realizar login.', 'error');
            }
        } catch (err) {
            showToast('Erro de conexão.', 'error');
        }
    };

    const changeUserPlan = async (user: any, newPlan: string) => {
        try {
            const response = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({ ...user, plan: newPlan })
            });
            if (response.ok) {
                showToast(`Plano alterado para ${newPlan}`, 'success');
                fetchUsers();
            }
        } catch (err) {
            showToast('Erro ao mudar plano.', 'error');
        }
    };

    const openUserModal = (user: any) => {
        setEditingUser({ ...user });
        setIsUserModalOpen(true);
    };

    const saveUserChanges = async () => {
        if (!editingUser) return;
        try {
            const response = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify(editingUser)
            });
            if (response.ok) {
                showToast('Usuário atualizado com sucesso!', 'success');
                setIsUserModalOpen(false);
                fetchUsers();
            }
        } catch (err) {
            showToast('Erro ao salvar usuário.', 'error');
        }
    };

    // Dynamic Plans State
    const [plans, setPlans] = useState<any[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);

    const fetchPlans = async () => {
        setIsLoadingPlans(true);
        try {
            const response = await fetch('/api/plans');
            if (response.ok) {
                const data = await response.json();
                setPlans(data);
            }
        } catch (err) {
            showToast('Erro ao carregar planos', 'error');
        } finally {
            setIsLoadingPlans(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'plans') {
            fetchPlans();
        }
    }, [activeTab]);

    const [planForm, setPlanForm] = useState({
        name: '',
        price: '',
        instances: 1,
        messages: 10000,
        aiNodes: 10,
        aiTokens: 100000,
        features: [] as string[]
    });

    const openPlanModal = (plan: any = null) => {
        if (plan) {
            setEditingPlan(plan);
            setPlanForm({ ...plan });
        } else {
            setEditingPlan(null);
            setPlanForm({
                name: '',
                price: '',
                instances: 1,
                messages: 10000,
                aiNodes: 10,
                aiTokens: 100000,
                features: []
            });
        }
        setIsPlanModalOpen(true);
    };

    const savePlan = async () => {
        if (!planForm.name || !planForm.price) {
            showToast('Preencha nome e preço do plano', 'error');
            return;
        }

        const method = editingPlan ? 'PUT' : 'POST';
        const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({
                    ...planForm,
                    ai_nodes: planForm.aiNodes,
                    ai_tokens: planForm.aiTokens
                })
            });

            if (response.ok) {
                showToast(editingPlan ? 'Plano atualizado!' : 'Novo plano criado!', 'success');
                setIsPlanModalOpen(false);
                fetchPlans();
            } else {
                const errorData = await response.json();
                showToast(`Erro ao salvar: ${errorData.details || errorData.error}`, 'error');
            }
        } catch (err) {
            showToast('Erro de conexão ao salvar plano', 'error');
        }
    };

    const deletePlan = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este plano?')) return;
        try {
            const response = await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                }
            });
            if (response.ok) {
                showToast('Plano excluído', 'success');
                fetchPlans();
            }
        } catch (err) {
            showToast('Erro ao excluir plano', 'error');
        }
    };

    const handleAction = (msg: string) => {
        showToast(msg, 'success');
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Admin Tabs */}
            <div className="flex flex-wrap items-center gap-3 p-2 bg-white dark:bg-card-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm w-fit">
                {[
                    { id: 'analytics', label: 'Financeiro', icon: 'insights' },
                    { id: 'users', label: 'Usuários', icon: 'people' },
                    { id: 'plans', label: 'Planos', icon: 'subscriptions' },
                    { id: 'payments', label: 'Pagamentos', icon: 'payments' },
                    { id: 'emails', label: 'E-mails & SMTP', icon: 'mail' },
                    { id: 'system', label: 'Sistema & API', icon: 'settings_suggest' },
                    { id: 'branding', label: 'Identidade & SEO', icon: 'palette' }
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
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button className="px-4 py-2 bg-white dark:bg-slate-700 shadow-sm rounded-lg text-[10px] font-black uppercase tracking-widest dark:text-white">Este Mês</button>
                                <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">3 Meses</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {loadingRevenue ? (
                                <div className="col-span-4 py-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando estatísticas...</div>
                            ) : [
                                { label: 'MRR Atual', val: `R$ ${revenueStats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: `${revenueStats.activePayingUsers} assinantes ativos`, color: 'text-indigo-600' },
                                { label: 'Novas Assinaturas', val: String(revenueStats.newSubscriptions), sub: revenueStats.newSubscriptions > 0 ? 'Este mês' : 'Nenhum novo registro', color: 'text-emerald-500' },
                                { label: 'LTV Estimado', val: `R$ ${parseFloat(revenueStats.ltv).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'Baseado em dados reais', color: 'text-primary' },
                                { label: 'Taxa de Churn', val: `${revenueStats.churnRate}%`, sub: parseFloat(revenueStats.churnRate) > 0 ? 'Atenção requerida' : 'Sem cancelamentos', color: 'text-rose-500' },
                            ].map((stat, i) => (
                                <div key={i} className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h4 className={`text-2xl font-black ${stat.color} mb-1`}>{stat.val}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{stat.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Revenue Placeholder Graph */}
                        <div className="bg-slate-50 dark:bg-white/5 rounded-huge p-8 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-8">
                                <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Crescimento de Receita (MRR)</h4>
                                <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-600"></div> <span className="text-slate-500">2026</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-300"></div> <span className="text-slate-500">2025</span></div>
                                </div>
                            </div>
                            <div className="h-64 flex items-end gap-3 px-4">
                                {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                                    <div key={i} className="flex-1 group relative">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">R$ 0</div>
                                        <div className="bg-slate-200 dark:bg-slate-800 w-full rounded-t-lg transition-all" style={{ height: `10px` }}></div>
                                        <div className="mt-4 text-[9px] font-black text-slate-400 text-center uppercase">{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i]}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-card-dark p-8 rounded-huge border border-slate-100 dark:border-white/5 shadow-xl">
                                <h4 className="text-sm font-black dark:text-white uppercase tracking-widest mb-6">Top Planos por Receita</h4>
                                <div className="space-y-6">
                                    {revenueStats.topPlans.length === 0 ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[11px] font-black uppercase">
                                                <span className="dark:text-white">Nenhum dado</span>
                                                <span className="text-slate-400">0%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-slate-200" style={{ width: '0%' }}></div>
                                            </div>
                                        </div>
                                    ) : revenueStats.topPlans.map((p, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between text-[11px] font-black uppercase">
                                                <span className="dark:text-white">{p.name}</span>
                                                <span className="text-slate-400">{p.percentage}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${i === 0 ? 'bg-indigo-600' : i === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${p.percentage}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-8 rounded-huge border border-slate-100 dark:border-white/5 shadow-xl">
                                <h4 className="text-sm font-black dark:text-white uppercase tracking-widest mb-6">Logs Recentes de Pagamento</h4>
                                <div className="space-y-4">
                                    {revenueStats.recentPayments.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">Nenhum pagamento registrado</p>
                                    ) : revenueStats.recentPayments.map((l, i) => (
                                        <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-white/5 last:border-0">
                                            <div>
                                                <p className="text-xs font-black dark:text-white uppercase tracking-tight">{l.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(l.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black dark:text-white uppercase">R$ {l.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                <p className={`text-[9px] font-black uppercase ${l.status === 'Aprovado' ? 'text-emerald-500' : 'text-amber-500'}`}>{l.status}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="p-8 space-y-8 animate-in fade-in duration-500">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-3xl font-black dark:text-white uppercase tracking-tighter mb-1">Gestão de Usuários</h3>
                                <p className="text-slate-500 text-sm font-medium">Controle total sobre os membros da plataforma</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-initial">
                                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar usuário..."
                                        className="w-full sm:w-64 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                                <button className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/5 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
                                    <span className="material-icons-round text-lg">download</span>
                                    Exportar
                                </button>
                            </div>
                        </div>

                        {loadingUsers ? (
                            <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <p className="font-black uppercase tracking-widest text-[10px]">Carregando usuários...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-8 sm:mx-0">
                                <div className="inline-block min-w-full align-middle px-8 sm:px-0">
                                    <div className="overflow-hidden border border-slate-100 dark:border-white/5 rounded-3xl shadow-sm">
                                        <table className="min-w-full divide-y divide-slate-100 dark:divide-white/5">
                                            <thead className="bg-slate-50/50 dark:bg-white/5">
                                                <tr>
                                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-5 px-6">Usuário</th>
                                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-5 px-6">Plano / Cargo</th>
                                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-5 px-6">Status</th>
                                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-5 px-6">Cadastro</th>
                                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right py-5 px-6">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-card-dark">
                                                {users.map((user) => (
                                                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                                        <td className="py-5 px-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="relative">
                                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-lg shadow-indigo-500/10">
                                                                        <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center font-black text-indigo-500">
                                                                            {user.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    </div>
                                                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${user.status === 'inactive' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black dark:text-white group-hover:text-indigo-500 transition-colors uppercase tracking-tight">{user.name}</p>
                                                                    <p className="text-[11px] text-slate-400 font-bold">{user.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 px-6">
                                                            <div className="flex flex-col gap-2">
                                                                <div className="relative group/select w-fit">
                                                                    <select
                                                                        value={user.plan}
                                                                        onChange={(e) => changeUserPlan(user, e.target.value)}
                                                                        className="appearance-none bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl pl-3 pr-10 py-2 text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 min-w-[120px]"
                                                                    >
                                                                        {plans.map(p => <option key={p.id} value={p.name} className="dark:bg-slate-900">{p.name}</option>)}
                                                                    </select>
                                                                    <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-sm text-indigo-400 pointer-events-none group-hover/select:translate-y-[-40%] transition-transform">unfold_more</span>
                                                                </div>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'text-amber-500' : 'text-slate-400 opacity-60'}`}>
                                                                    {user.role === 'admin' ? '💻 Administrador' : '👤 Usuário'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 px-6">
                                                            <button
                                                                onClick={() => toggleUserStatus(user)}
                                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${user.status === 'active'
                                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                                                    : user.status === 'suspended'
                                                                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                                                                        : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100'
                                                                    }`}
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500 animate-pulse' : user.status === 'suspended' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                                    {user.status === 'active' ? 'Ativo' : user.status === 'suspended' ? 'Suspenso' : 'Expirado'}
                                                                </span>
                                                                <span className="material-icons-round text-xs">{user.status === 'active' ? 'check_circle' : 'block'}</span>
                                                            </button>
                                                        </td>
                                                        <td className="py-5 px-6">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold dark:text-white uppercase tracking-tighter">
                                                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '---'}
                                                                </span>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase opacity-60">Criado em</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 px-6 text-right">
                                                            <div className="flex items-center justify-end gap-2 text-slate-400">
                                                                <button
                                                                    onClick={() => handleImpersonate(user)}
                                                                    className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all flex items-center justify-center group/btn"
                                                                    title="Logar como este usuário"
                                                                >
                                                                    <span className="material-icons-round text-lg group-hover/btn:scale-110 transition-transform">login</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => openUserModal(user)}
                                                                    className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex items-center justify-center group/btn"
                                                                >
                                                                    <span className="material-icons-round text-lg group-hover/btn:scale-110 transition-transform">edit_note</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteUser(user.id)}
                                                                    className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 hover:border-rose-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all flex items-center justify-center group/btn"
                                                                >
                                                                    <span className="material-icons-round text-lg group-hover/btn:scale-110 transition-transform">delete_sweep</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* User Edit Modal */}
                        {isUserModalOpen && editingUser && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-card-dark w-full max-w-xl rounded-[40px] shadow-3xl border border-white/20 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between relative bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-500/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-600/20">
                                                <span className="material-icons-round text-white text-3xl">manage_accounts</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black dark:text-white tracking-tighter uppercase">{editingUser.name || 'Novo Usuário'}</h4>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] opacity-80">Editar Permissões & Dados</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsUserModalOpen(false)}
                                            className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center"
                                        >
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>

                                    <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    <span className="material-icons-round text-xs">person</span> Nome do Usuário
                                                </label>
                                                <input
                                                    value={editingUser.name}
                                                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                                    type="text"
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[22px] px-6 py-4 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    <span className="material-icons-round text-xs">alternate_email</span> E-mail de Acesso
                                                </label>
                                                <input
                                                    value={editingUser.email}
                                                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                                    type="email"
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[22px] px-6 py-4 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    <span className="material-icons-round text-xs">stars</span> Cargo & Acesso
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['user', 'admin'].map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => setEditingUser({ ...editingUser, role: r })}
                                                            className={`py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${editingUser.role === r ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-500 hover:border-slate-200'}`}
                                                        >
                                                            {r === 'admin' ? 'Admin' : 'Membro'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    <span className="material-icons-round text-xs">power_settings_new</span> Status da Conta
                                                </label>
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {[
                                                        { id: 'active', l: 'Ativo', c: 'emerald' },
                                                        { id: 'suspended', l: 'Suspenso', c: 'rose' },
                                                        { id: 'expired', l: 'Expirado', c: 'amber' }
                                                    ].map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => setEditingUser({ ...editingUser, status: s.id })}
                                                            className={`py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${editingUser.status === s.id
                                                                ? `bg-${s.c}-500 border-${s.c}-500 text-white shadow-lg shadow-${s.c}-500/30`
                                                                : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-500 hover:border-slate-200'}`}
                                                        >
                                                            {s.l}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 p-6 bg-slate-50 dark:bg-slate-900 rounded-[30px] border border-slate-100 dark:border-white/5">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <span className="material-icons-round text-xs text-amber-500">lock_open</span> Expiração do Teste / Período
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={editingUser.trial_ends_at ? new Date(new Date(editingUser.trial_ends_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                                onChange={e => setEditingUser({ ...editingUser, trial_ends_at: e.target.value })}
                                                className="w-full bg-white dark:bg-black/20 border-none rounded-2xl px-6 py-4 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            />
                                            <p className="text-[9px] text-slate-400 font-black uppercase opacity-60">* Este campo só é relevante para usuários no plano "Teste Grátis".</p>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-4">
                                        <button
                                            onClick={() => setIsUserModalOpen(false)}
                                            className="flex-1 py-4 bg-white dark:bg-card-dark text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-50 transition-all"
                                        >
                                            Descartar
                                        </button>
                                        <button
                                            onClick={saveUserChanges}
                                            className="flex-2 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
                                        >
                                            Atualizar Usuário
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'plans' && (
                    <div className="p-8 space-y-8 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Gestão de Planos</h3>
                                <p className="text-slate-500 text-sm font-medium">Crie e edite as ofertas do seu SaaS</p>
                            </div>
                            <button
                                onClick={() => openPlanModal()}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
                            >
                                <span className="material-icons-round">add</span> Novo Plano
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map((plan) => (
                                <div key={plan.id} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 relative group">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-lg font-black dark:text-white uppercase tracking-tight">{plan.name}</h4>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openPlanModal(plan)} className="text-slate-400 hover:text-indigo-500 transition-colors"><span className="material-icons-round text-sm">edit</span></button>
                                            <button onClick={() => deletePlan(plan.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><span className="material-icons-round text-sm">delete</span></button>
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black dark:text-white mb-4">R$ {plan.price}<span className="text-xs text-slate-500 uppercase tracking-widest font-bold">/mês</span></p>

                                    <div className="space-y-2 mb-6">
                                        {[
                                            { l: 'Instâncias', v: plan.instances },
                                            { l: 'Mensagens', v: plan.messages.toLocaleString() },
                                            { l: 'Nós de IA', v: plan.aiNodes },
                                        ].map((f, i) => (
                                            <div key={i} className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                                <span className="text-slate-400">{f.l}</span>
                                                <span className="dark:text-white">{f.v}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                        {plan.features.map((featId: string, i: number) => {
                                            const feature = FEATURE_OPTIONS.find(f => f.id === featId) || { label: featId, icon: 'check_circle' };
                                            return (
                                                <div key={i} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border border-indigo-500/10 shadow-sm" title={feature.label}>
                                                    <span className="material-icons-round text-[10px] text-indigo-500">{feature.icon}</span>
                                                    <span className="text-[8px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{feature.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Plan Modal */}
                        {isPlanModalOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-huge shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-widest dark:text-white">{editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Defina as regras e limites do plano</p>
                                        </div>
                                        <button onClick={() => setIsPlanModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Plano</label>
                                                <input value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} type="text" placeholder="Ex: Master IA" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Mensal (R$)</label>
                                                <input value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} type="number" placeholder="299" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Limite de Instâncias</label>
                                                <input value={planForm.instances} onChange={e => setPlanForm({ ...planForm, instances: parseInt(e.target.value) })} type="number" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensagens / Mês</label>
                                                <input value={planForm.messages} onChange={e => setPlanForm({ ...planForm, messages: parseInt(e.target.value) })} type="number" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tokens de IA</label>
                                                <input value={planForm.aiTokens} onChange={e => setPlanForm({ ...planForm, aiTokens: parseInt(e.target.value) })} type="number" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nós de IA por Fluxo</label>
                                                <input value={planForm.aiNodes} onChange={e => setPlanForm({ ...planForm, aiNodes: parseInt(e.target.value) })} type="number" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Funcionalidades Incluídas</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {FEATURE_OPTIONS.map((feature) => {
                                                    const isSelected = planForm.features.includes(feature.id);
                                                    return (
                                                        <button
                                                            key={feature.id}
                                                            onClick={() => {
                                                                const newFeatures = isSelected
                                                                    ? planForm.features.filter(f => f !== feature.id)
                                                                    : [...planForm.features, feature.id];
                                                                setPlanForm({ ...planForm, features: newFeatures });
                                                            }}
                                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-500/10'
                                                                : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-500 hover:border-slate-200 dark:hover:border-white/10'
                                                                }`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                                                                <span className="material-icons-round text-lg">{feature.icon}</span>
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-tight">{feature.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white dark:bg-card-dark border-t border-slate-100 dark:border-white/5 flex gap-4">
                                        <button onClick={() => setIsPlanModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancelar</button>
                                        <button onClick={savePlan} className="flex-1 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all">{editingPlan ? 'Atualizar' : 'Criar Plano'}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="p-8 space-y-8 animate-in fade-in duration-500">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/30">
                                <img src="https://stripe.com/favicon.ico" className="w-8 h-8 filter brightness-0 invert" alt="Stripe" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Gateway de Pagamento</h3>
                                <p className="text-slate-500 text-sm font-medium">Configurações globais do Stripe Checkout</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Stripe Public Key (Live)</label>
                                    <input
                                        type="text"
                                        value={settings.stripe_public_key}
                                        onChange={e => setSettings({ ...settings, stripe_public_key: e.target.value })}
                                        placeholder="pk_live_..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Stripe Secret Key (Live)</label>
                                    <input
                                        type="password"
                                        value={settings.stripe_secret_key}
                                        onChange={e => setSettings({ ...settings, stripe_secret_key: e.target.value })}
                                        placeholder="sk_live_..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Stripe Webhook Secret (whsec_...)</label>
                                    <input
                                        type="password"
                                        value={settings.stripe_webhook_secret}
                                        onChange={e => setSettings({ ...settings, stripe_webhook_secret: e.target.value })}
                                        placeholder="whsec_..."
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono"
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-indigo-950/20 border border-slate-200 dark:border-indigo-500/20 rounded-huge p-6 space-y-4">
                                <h4 className="text-xs font-black dark:text-white uppercase tracking-widest">Webhooks do Stripe</h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">Configure a URL abaixo no painel do Stripe para processar renovações e cancelamentos automáticos.</p>
                                <div className="relative group">
                                    <input readOnly value={`${window.location.origin}/api/stripe/webhook`} className="w-full bg-white dark:bg-indigo-900/30 border-none rounded-xl px-4 py-3 text-[11px] dark:text-indigo-200 font-bold" />
                                    <span
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/api/stripe/webhook`);
                                            showToast('URL do Webhook copiada!', 'info');
                                        }}
                                        className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 cursor-pointer text-sm hover:text-indigo-600 transition-colors">content_copy</span>
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase italic">* Eventos recomendados: checkout.session.completed, customer.subscription.deleted</p>
                            </div>
                        </div>
                        <button onClick={saveSettings} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95">Salvar Configuração de Pagamento</button>

                    </div>
                )}

                {activeTab === 'emails' && (
                    <div className="p-8 space-y-10 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Central de Automação</h3>
                            <p className="text-slate-500 text-sm font-medium">Templates de e-mail e servidor SMTP ZeptoMail</p>
                        </div>

                        {/* ZeptoMail Config */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-huge border border-slate-100 dark:border-white/5 space-y-6">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-indigo-500">alternate_email</span>
                                    <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Configuração ZeptoMail (API Nativa)</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuário SMTP (ZeptoMail: emailapikey)</label>
                                        <input value={settings.smtp_user} onChange={e => setSettings({ ...settings, smtp_user: e.target.value })} type="text" placeholder="emailapikey" className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ZeptoMail Send Mail Token (Senha SMTP)</label>
                                        <input value={settings.smtp_pass} onChange={e => setSettings({ ...settings, smtp_pass: e.target.value })} type="password" placeholder="wSsVR61x+Rb5..." className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Remetente (De)</label>
                                        <input value={settings.smtp_from_email} onChange={e => setSettings({ ...settings, smtp_from_email: e.target.value })} type="text" placeholder="contato@ublochat.com.br" className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Remetente</label>
                                        <input value={settings.smtp_from_name} onChange={e => setSettings({ ...settings, smtp_from_name: e.target.value })} type="text" placeholder="Equipe MyZap" className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-indigo-950/20 border-2 border-dashed border-indigo-500/20 p-8 rounded-huge space-y-6">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-indigo-500">science</span>
                                    <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Testar Envio de E-mail</h4>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Envie um e-mail de teste real agora</p>
                                <div className="space-y-4">
                                    <input
                                        type="email"
                                        placeholder="E-mail de destino (Ex: voce@email.com)"
                                        value={settings.smtp_test_email}
                                        onChange={(e) => setSettings({ ...settings, smtp_test_email: e.target.value })}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!settings.smtp_test_email) return showToast('Preencha o e-mail de teste', 'warning');
                                            try {
                                                const res = await fetch('/api/admin/test-email', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                                                    },
                                                    body: JSON.stringify(settings)
                                                });
                                                if (res.ok) showToast('E-mail de teste enviado!', 'success');
                                                else showToast('Erro ao enviar teste.', 'error');
                                            } catch (e) { showToast('Falha na comunicação.', 'error'); }
                                        }}
                                        className="w-full py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons-round text-sm">send</span>
                                        Enviar Teste Agora
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Activation Settings */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 p-6 rounded-huge border border-purple-200 dark:border-purple-500/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                        <span className="material-icons-round text-white">verified_user</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Exigir Ativação de Conta</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Novos usuários devem confirmar email antes de acessar</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.require_email_activation === 'true'}
                                        onChange={(e) => setSettings({ ...settings, require_email_activation: e.target.checked ? 'true' : 'false' })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Email Templates List */}
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Modelos de E-mail Ativos</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { id: 'WELCOME', name: 'Bem-vindo ao MyZap', trigger: 'Criação de Conta', color: 'bg-indigo-500' },
                                    { id: 'ACCOUNT_ACTIVATION', name: 'Ativação de Conta', trigger: 'Código por Email', color: 'bg-purple-500' },
                                    { id: 'PAYMENT_APPROVED', name: 'Pagamento Aprovado', trigger: 'Stripe Callback', color: 'bg-emerald-500' },
                                    { id: 'EXPIRING_SOON', name: 'Assinatura Vencendo', trigger: '7 dias antes', color: 'bg-amber-500' },
                                    { id: 'EXPIRED', name: 'Acesso Expirado', trigger: 'Inadimplência', color: 'bg-rose-500' },
                                    { id: 'PASSWORD_RECOVERY', name: 'Recuperação de Senha', trigger: 'Clique Esqueci Senha', color: 'bg-indigo-400' },
                                    { id: 'PASSWORD_CHANGED', name: 'Senha Alterada', trigger: 'Após Troca de Senha', color: 'bg-teal-500' },
                                ].map((email, idx) => (
                                    <div key={idx} className="p-5 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 rounded-3xl flex items-center gap-4 hover:border-indigo-500 transition-all cursor-pointer shadow-sm relative group">
                                        <div className={`w-3 h-12 rounded-full ${email.color}`}></div>
                                        <div className="flex-1">
                                            <p className="text-xs font-black dark:text-white uppercase tracking-tight">{email.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{email.trigger}</p>
                                        </div>
                                        <button
                                            onClick={() => setPreviewEmail(email.id as any)}
                                            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all flex items-center justify-center"
                                        >
                                            <span className="material-icons-round text-sm">visibility</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Email Preview Modal */}
                        {previewEmail && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-huge shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <h4 className="text-sm font-black uppercase tracking-widest dark:text-white">Preview: {emailTemplates[previewEmail].subject}</h4>
                                        <button onClick={() => setPreviewEmail(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                    <div className="p-8 bg-slate-50 dark:bg-slate-900 overflow-y-auto max-h-[60vh]">
                                        <div
                                            className="bg-white rounded-2xl shadow-sm p-8"
                                            dangerouslySetInnerHTML={{ __html: emailTemplates[previewEmail].html }}
                                        />
                                    </div>
                                    <div className="p-6 bg-white dark:bg-card-dark border-t border-slate-100 dark:border-white/5 flex justify-end">
                                        <button onClick={() => setPreviewEmail(null)} className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Fechar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button onClick={saveSettings} className="bg-slate-900 dark:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:opacity-90 transition-all">Salvar Configurações de E-mail</button>

                        {/* Dynamic Email Templates Editor */}
                        <div className="pt-10 border-t border-slate-100 dark:border-white/5 space-y-8">
                            <div>
                                <h4 className="text-lg font-black dark:text-white uppercase tracking-tighter">Editor de Modelos Dinâmicos</h4>
                                <p className="text-slate-500 text-sm font-medium">Personalize o conteúdo HTML dos e-mails automáticos</p>
                            </div>

                            <div className="grid grid-cols-1 gap-8">
                                {dbTemplates.map((tpl) => (
                                    <div key={tpl.id} className="bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 rounded-huge p-8 shadow-xl space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-icons-round text-indigo-500">edit_note</span>
                                                <h4 className="text-xs font-black dark:text-white uppercase tracking-widest">{tpl.template_key.replace('_', ' ')}</h4>
                                            </div>
                                            <button
                                                onClick={() => saveEmailTemplate(tpl)}
                                                className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
                                            >
                                                <span className="material-icons-round text-xs">save</span>
                                                Salvar Template
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
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
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corpo HTML</label>
                                                <textarea
                                                    value={tpl.body_html}
                                                    onChange={e => {
                                                        const newTpls = [...dbTemplates];
                                                        const idx = newTpls.findIndex(t => t.id === tpl.id);
                                                        newTpls[idx].body_html = e.target.value;
                                                        setDbTemplates(newTpls);
                                                    }}
                                                    rows={8}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <SystemSettingsTab settings={settings} setSettings={setSettings} saveSettings={saveSettings} loading={loadingSettings} />
                )}

                {activeTab === 'branding' && (
                    <BrandingSettingsTab settings={settings} setSettings={setSettings} saveSettings={saveSettings} />
                )}
            </div>
        </div>
    );
};

const BrandingSettingsTab: React.FC<{
    settings: any,
    setSettings: (s: any) => void,
    saveSettings: () => Promise<void>
}> = ({ settings, setSettings, saveSettings }) => {
    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/30">
                    <span className="material-icons-round text-white text-3xl">palette</span>
                </div>
                <div>
                    <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Identidade Visual</h3>
                    <p className="text-slate-500 text-sm font-medium">Personalize a marca e as cores do sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-huge border border-slate-100 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Configurações de Marca</h4>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Sistema</label>
                            <input
                                value={settings.system_name}
                                onChange={e => setSettings({ ...settings, system_name: e.target.value })}
                                type="text"
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Primária (Hex)</label>
                            <div className="flex gap-4">
                                <input
                                    value={settings.primary_color}
                                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                                    type="text"
                                    className="flex-1 bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                />
                                <input
                                    type="color"
                                    value={settings.primary_color}
                                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                                    className="w-14 h-auto border-none bg-transparent cursor-pointer rounded-2xl"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-huge border border-slate-100 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logos e Favicon</h4>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL do Logo (SVG ou PNG)</label>
                            <input
                                value={settings.logo_url}
                                onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
                                type="text"
                                placeholder="https://..."
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL do Favicon (.ico ou .png)</label>
                            <input
                                value={settings.favicon_url}
                                onChange={e => setSettings({ ...settings, favicon_url: e.target.value })}
                                type="text"
                                placeholder="https://..."
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-indigo-600/5 p-8 rounded-huge border-2 border-dashed border-indigo-500/20 space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="material-icons-round text-indigo-500">search</span>
                            <h4 className="text-sm font-black dark:text-white uppercase tracking-widest text-indigo-500">SEO Premium</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título SEO (Meta Title)</label>
                                <input
                                    value={settings.seo_title}
                                    onChange={e => setSettings({ ...settings, seo_title: e.target.value })}
                                    type="text"
                                    className="w-full bg-white dark:bg-card-dark border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição SEO (Meta Description)</label>
                                <textarea
                                    value={settings.seo_description}
                                    onChange={e => setSettings({ ...settings, seo_description: e.target.value })}
                                    rows={3}
                                    className="w-full bg-white dark:bg-card-dark border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Palavras-chave (Keywords)</label>
                                <input
                                    value={settings.seo_keywords}
                                    onChange={e => setSettings({ ...settings, seo_keywords: e.target.value })}
                                    type="text"
                                    placeholder="whatsapp, automação, multi-agente"
                                    className="w-full bg-white dark:bg-card-dark border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-huge border border-amber-200 dark:border-amber-500/20">
                        <div className="flex gap-3">
                            <span className="material-icons-round text-amber-500">info</span>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Dica Premium</p>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">As alterações de nome e cores refletem em tempo real em todas as telas para todos os usuários.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={saveSettings}
                className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
            >
                <span className="material-icons-round">save</span>
                Aplicar Branding & SEO
            </button>
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
