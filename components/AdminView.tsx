import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import { emailTemplates } from '../lib/EmailTemplates';

const AdminView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'payments' | 'emails' | 'analytics'>('analytics');
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
        smtp_key: '',
        smtp_from_email: '',
        smtp_from_name: ''
    });
    const [loadingSettings, setLoadingSettings] = useState(true);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) setSettings({
                evolution_url: data.evolution_url || '',
                evolution_apikey: data.evolution_apikey || '',
                stripe_public_key: data.stripe_public_key || '',
                stripe_secret_key: data.stripe_secret_key || '',
                stripe_webhook_secret: data.stripe_webhook_secret || '',
                smtp_host: data.smtp_host || 'smtp.zeptomail.com',
                smtp_port: data.smtp_port || '587',
                smtp_key: data.smtp_key || '',
                smtp_from_email: data.smtp_from_email || '',
                smtp_from_name: data.smtp_from_name || ''
            });
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    useEffect(() => {
        fetchSettings();
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
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
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
                    { id: 'emails', label: 'Automação & SMTP', icon: 'mail' },
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
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button className="px-4 py-2 bg-white dark:bg-slate-700 shadow-sm rounded-lg text-[10px] font-black uppercase tracking-widest dark:text-white">Este Mês</button>
                                <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">3 Meses</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'MRR Atual', val: 'R$ 0', sub: 'Média de R$ 0/mês', color: 'text-indigo-600' },
                                { label: 'Novas Assinaturas', val: '0', sub: 'Nenhum novo registro', color: 'text-emerald-500' },
                                { label: 'LTV Estimado', val: 'R$ 0', sub: 'Baseado em dados reais', color: 'text-primary' },
                                { label: 'Taxa de Churn', val: '0%', sub: 'Sem cancelamentos', color: 'text-rose-500' },
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
                                    {[
                                        { n: 'Nenhum dado', p: '0%', c: 'bg-slate-200' },
                                    ].map((p, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between text-[11px] font-black uppercase">
                                                <span className="dark:text-white">{p.n}</span>
                                                <span className="text-slate-400">{p.p}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${p.c}`} style={{ width: p.p }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-8 rounded-huge border border-slate-100 dark:border-white/5 shadow-xl">
                                <h4 className="text-sm font-black dark:text-white uppercase tracking-widest mb-6">Logs Recentes de Pagamento</h4>
                                <div className="space-y-4">
                                    {[
                                        { d: 'Hoje, 14:20', u: 'Luiz Silva', a: 'R$ 299,00', s: 'Aprovado' },
                                        { d: 'Hoje, 12:45', u: 'Ana Clara', a: 'R$ 99,00', s: 'Aprovado' },
                                        { d: 'Ontem, 23:10', u: 'Roberto M.', a: 'R$ 499,00', s: 'Aprovado' },
                                        { d: 'Ontem, 19:00', u: 'Carlos V.', a: 'R$ 299,00', s: 'Pendente' },
                                    ].map((l, i) => (
                                        <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-white/5 last:border-0">
                                            <div>
                                                <p className="text-xs font-black dark:text-white uppercase tracking-tight">{l.u}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{l.d}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black dark:text-white uppercase">{l.a}</p>
                                                <p className={`text-[9px] font-black uppercase ${l.s === 'Aprovado' ? 'text-emerald-500' : 'text-amber-500'}`}>{l.s}</p>
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Gestão de Usuários</h3>
                                <p className="text-slate-500 text-sm font-medium">Controle total sobre os membros da plataforma</p>
                            </div>
                            <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">Exportar CSV</button>
                        </div>

                        {loadingUsers ? (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando usuários reais...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-white/5">
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-4 px-4">Usuário</th>
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-4 px-4">Plano</th>
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-4 px-4">Cargo</th>
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-4 px-4">Status</th>
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left py-4 px-4">Cadastro</th>
                                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right py-4 px-4">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user.id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black dark:text-white">{user.name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <select
                                                        value={user.plan}
                                                        onChange={(e) => changeUserPlan(user, e.target.value)}
                                                        className="bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase border-none focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                                                    >
                                                        {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                        {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <button
                                                        onClick={() => toggleUserStatus(user)}
                                                        className="flex items-center gap-2 group"
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${(user.status || 'active') === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></span>
                                                        <span className="text-xs font-black dark:text-white uppercase tracking-tighter group-hover:underline">{(user.status || 'active') === 'active' ? 'Ativo' : 'Suspenso'}</span>
                                                    </button>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="text-sm text-slate-500 font-medium">
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openUserModal(user)}
                                                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 transition-all flex items-center justify-center" title="Editar Usuário"
                                                        >
                                                            <span className="material-icons-round text-lg">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 transition-all flex items-center justify-center" title="Excluir Definitivamente"
                                                        >
                                                            <span className="material-icons-round text-lg">delete_forever</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* User Edit Modal */}
                        {isUserModalOpen && editingUser && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-card-dark w-full max-w-xl rounded-huge shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-widest dark:text-white">Editar Usuário: {editingUser.name}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ajuste as informações e permissões do usuário</p>
                                        </div>
                                        <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                                            <input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} type="text" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                            <input value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} type="email" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cargo</label>
                                                <select
                                                    value={editingUser.role}
                                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'user' | 'admin' })}
                                                    className="w-full bg-slate-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                                >
                                                    <option value="user" className="dark:bg-slate-800">Usuário Comum</option>
                                                    <option value="admin" className="dark:bg-slate-800">Administrador</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                                <select
                                                    value={editingUser.status}
                                                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'active' | 'inactive' })}
                                                    className="w-full bg-slate-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                                >
                                                    <option value="active" className="dark:bg-slate-800">Ativo</option>
                                                    <option value="inactive" className="dark:bg-slate-800">Inativo</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 pt-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fim do Teste Grátis (Trial Ends)</label>
                                            <input
                                                type="datetime-local"
                                                value={editingUser.trial_ends_at ? new Date(new Date(editingUser.trial_ends_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                                onChange={e => setEditingUser({ ...editingUser, trial_ends_at: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[9px] text-slate-400 font-bold uppercase ml-1 italic">* Deixe vazio se não for um usuário em teste.</p>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white dark:bg-card-dark border-t border-slate-100 dark:border-white/5 flex gap-4">
                                        <button onClick={() => setIsUserModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancelar</button>
                                        <button onClick={saveUserChanges} className="flex-1 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all">Salvar Alterações</button>
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
                        <div className="bg-white dark:bg-indigo-950/10 border border-indigo-500/10 rounded-huge p-8 space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-icons-round text-indigo-500">dns</span>
                                <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Servidor SMTP ZeptoMail</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Host</label>
                                    <input
                                        value={settings.smtp_host}
                                        onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Port</label>
                                    <input
                                        value={settings.smtp_port}
                                        onChange={e => setSettings({ ...settings, smtp_port: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ZeptoMail API Key</label>
                                    <input
                                        type="password"
                                        placeholder="api_key_..."
                                        value={settings.smtp_key}
                                        onChange={e => setSettings({ ...settings, smtp_key: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Envio (From)</label>
                                    <input
                                        type="email"
                                        placeholder="noreply@seudominio.com"
                                        value={settings.smtp_from_email}
                                        onChange={e => setSettings({ ...settings, smtp_from_email: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Remetente</label>
                                    <input
                                        type="text"
                                        placeholder="Sua Empresa"
                                        value={settings.smtp_from_name}
                                        onChange={e => setSettings({ ...settings, smtp_from_name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email Templates List */}
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Modelos de E-mail Ativos</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { id: 'WELCOME', name: 'Bem-vindo ao MyZap', trigger: 'Criação de Conta', color: 'bg-indigo-500' },
                                    { id: 'PAYMENT_APPROVED', name: 'Pagamento Aprovado', trigger: 'Stripe Callback', color: 'bg-emerald-500' },
                                    { id: 'EXPIRING_SOON', name: 'Assinatura Vencendo', trigger: '7 dias antes', color: 'bg-amber-500' },
                                    { id: 'EXPIRED', name: 'Acesso Expirado', trigger: 'Inadimplência', color: 'bg-rose-500' },
                                    { id: 'PASSWORD_RECOVERY', name: 'Recuperação de Senha', trigger: 'Clique Esqueci Senha', color: 'bg-indigo-400' },
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

                        <button onClick={() => handleAction('Automação de e-mails atualizada!')} className="bg-slate-900 dark:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:opacity-90 transition-all">Salvar Automações</button>
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
