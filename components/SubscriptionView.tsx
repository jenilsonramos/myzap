import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const SubscriptionView: React.FC = () => {
    const { showToast } = useToast();
    const [subInfo, setSubInfo] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    // State for dashboard data
    const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('myzap_user') || '{}'));
    const [usage, setUsage] = useState({
        instances: { used: 0, total: 10 },
        messages: { used: 0, total: 100000 },
        webhooks: { used: 0, total: 20 },
        aiNodes: { used: 0, total: 50 }
    });

    const syncProfile = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) {
                const refreshedUser = await response.json();
                localStorage.setItem('myzap_user', JSON.stringify(refreshedUser));
                setUser(refreshedUser);
                return refreshedUser;
            }
        } catch (err) {
            console.error('Erro ao sincronizar perfil:', err);
        }
        return user;
    };

    const fetchSubData = async () => {
        try {
            const response = await fetch('/api/user/subscription', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSubInfo(data);
            }
        } catch (err) {
            console.error('Erro ao buscar assinatura:', err);
        }
    };

    const fetchPlansAndCalculateLimits = async (currentUser: any) => {
        try {
            const response = await fetch('/api/plans');
            if (response.ok) {
                const allPlans = await response.json();
                setPlans(allPlans);

                const currentPlan = allPlans.find((p: any) => p.name === currentUser.plan);
                if (currentPlan) {
                    setUsage(prev => ({
                        ...prev,
                        instances: { ...prev.instances, total: currentPlan.instances || 10 },
                        messages: { ...prev.messages, total: currentPlan.messages || 100000 },
                        aiNodes: { ...prev.aiNodes, total: currentPlan.ai_nodes || 50 }
                    }));
                }
            }
        } catch (err) {
            console.error('Erro ao carregar planos:', err);
        }
    };

    const fetchUsage = async () => {
        try {
            const response = await fetch('/api/user/usage', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsage(prev => ({
                    ...prev,
                    instances: { ...prev.instances, used: data.instances },
                    messages: { ...prev.messages, used: data.messages },
                    aiNodes: { ...prev.aiNodes, used: data.aiNodes }
                }));
            }
        } catch (err) {
            console.error('Erro ao buscar uso:', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const isSuccess = urlParams.get('payment') === 'success';

            if (isSuccess) {
                showToast('Pagamento recebido! Atualizando seu plano...', 'success');
                // Pequeno delay para o webhook processar
                await new Promise(r => setTimeout(r, 2000));
            }

            const refreshedUser = await syncProfile();
            await Promise.all([
                fetchSubData(),
                fetchPlansAndCalculateLimits(refreshedUser),
                fetchUsage()
            ]);
            setLoading(false);
        };
        init();
    }, []);

    const handleUpgrade = async (planName: string) => {
        if (planName === user.plan) return;

        showToast(`Iniciando checkout para o plano ${planName}...`, 'info');
        try {
            const plan = plans.find(p => p.name === planName);
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({
                    planName: plan.name,
                    price: plan.price,
                    successUrl: `${window.location.origin}/my-plan?payment=success`,
                    cancelUrl: `${window.location.origin}/my-plan?payment=cancel`
                })
            });

            const data = await response.json();
            if (response.ok && data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Erro ao criar sessão de pagamento');
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleCancelSubscription = async () => {
        setIsCancelling(true);
        try {
            const response = await fetch('/api/stripe/cancel-subscription', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message, 'success');
                setShowCancelModal(false);
                fetchSubData();
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full"><span className="material-icons-round animate-spin text-primary text-4xl">sync</span></div>;

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Subscription Detail Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className={`lg:col-span-8 bg-gradient-to-br ${user.status === 'active' ? 'from-indigo-600 to-indigo-800 shadow-indigo-600/20' : 'from-rose-600 to-rose-800 shadow-rose-600/20'} rounded-huge p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[250px] shadow-2xl transition-colors duration-500`}>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit mb-4">
                                <span className={`w-2 h-2 ${user.status === 'active' ? 'bg-emerald-400' : 'bg-white'} rounded-full ${user.status === 'active' ? 'animate-pulse' : ''} shadow-[0_0_8px_white]`}></span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{user.status === 'active' ? 'Assinatura Ativa' : 'Assinatura Expirada'}</span>
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter mb-2">{user.plan}</h2>
                            <p className="text-indigo-100 text-sm font-medium opacity-80">
                                {user.status === 'active'
                                    ? (subInfo?.cancel_at_period_end ? "Sua assinatura será encerrada em breve." : "Sua conta está configurada para renovação automática.")
                                    : "Seu acesso às funcionalidades está bloqueado. Escolha um plano abaixo para reativar."}
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 rotate-12">
                            <span className="material-icons-round text-5xl">{user.status === 'active' ? 'workspace_premium' : 'lock_clock'}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-8 relative z-10">
                        {user.status === 'active' && subInfo?.active && !subInfo.cancel_at_period_end && (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-rose-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-rose-500/30 transition-all active:scale-95"
                            >
                                Cancelar Renovação
                            </button>
                        )}
                        {user.status === 'inactive' && (
                            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 text-[10px] font-black uppercase tracking-wider">
                                Renovação Necessária
                            </div>
                        )}
                        <p className="text-[10px] font-bold text-white/60">
                            {subInfo?.current_period_end
                                ? `Ciclo termina em: ${new Date(subInfo.current_period_end * 1000).toLocaleDateString()}`
                                : (user.status === 'active' ? "Cobrança Automática Ativada" : "Plano Expirado")}
                        </p>
                    </div>
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="lg:col-span-4 bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl flex flex-col items-center justify-center text-center">
                    <span className={`material-icons-round ${user.status === 'active' ? 'text-indigo-500' : 'text-rose-500'} text-5xl mb-4`}>{user.status === 'active' ? 'autorenew' : 'credit_card_off'}</span>
                    <h4 className="text-lg font-black dark:text-white mb-2">{user.status === 'active' ? 'Renovação Automática' : 'Pagamento Pendente'}</h4>
                    <p className="text-xs text-slate-500 font-medium px-4">
                        {user.status === 'active'
                            ? 'As cobranças serão feitas no cartão utilizado no ato da compra.'
                            : 'Selecione um plano abaixo para normalizar sua conta.'}
                    </p>
                </div>

            </div>

            {/* Usage Limits Section */}
            <div className="bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Limites de Uso</h3>
                        <p className="text-slate-500 text-sm font-medium">Recursos disponíveis no seu plano atual</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                        <span className="material-icons-round">analytics</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Instâncias */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Instâncias</p>
                            <p className="text-base font-black text-slate-800 dark:text-white">
                                {usage.instances.used} / {usage.instances.total === 999 ? '∞' : usage.instances.total}
                            </p>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min((usage.instances.used / (usage.instances.total || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                    {/* Mensagens */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Mensagens</p>
                            <p className="text-base font-black text-slate-800 dark:text-white">
                                {usage.messages.used.toLocaleString()} / {usage.messages.total > 1000000 ? '∞' : usage.messages.total.toLocaleString()}
                            </p>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min((usage.messages.used / (usage.messages.total || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                    {/* IA Nodes */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nós de IA</p>
                            <p className="text-base font-black text-slate-800 dark:text-white">
                                {usage.aiNodes.used} / {usage.aiNodes.total > 1000000 ? '∞' : usage.aiNodes.total}
                            </p>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min((usage.aiNodes.used / (usage.aiNodes.total || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plans List */}
            <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-indigo-500 rounded-full"></span>
                    Mudar de Plano
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((p: any) => {
                        const isCurrent = p.name === user.plan;
                        return (
                            <div key={p.id} className={`bg-white dark:bg-card-dark rounded-huge p-6 border ${isCurrent ? 'border-primary shadow-primary/10 transition-all' : 'border-slate-100 dark:border-white/5'} shadow-lg group relative overflow-hidden`}>
                                {isCurrent && (
                                    <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-bl-2xl tracking-widest animate-in slide-in-from-right-full">
                                        Plano Atual
                                    </div>
                                )}
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${isCurrent ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    <span className="material-icons-round">{p.name.includes('IA') ? 'auto_fix_high' : 'rocket_launch'}</span>
                                </div>
                                <h4 className="text-lg font-black dark:text-white mb-2 uppercase">{p.name}</h4>
                                <div className="flex items-baseline gap-1 mb-8">
                                    <span className="text-3xl font-black dark:text-white">R$ {Math.floor(p.price)}</span>
                                    <span className="text-sm text-slate-400 font-bold">/mês</span>
                                </div>
                                <button
                                    disabled={isCurrent}
                                    onClick={() => handleUpgrade(p.name)}
                                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isCurrent ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:shadow-indigo-500/20 active:scale-95'}`}
                                >
                                    {isCurrent ? 'Ativo no momento' : 'Selecionar Plano'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowCancelModal(false)}></div>
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-huge p-8 relative z-10 shadow-huge animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
                            <span className="material-icons-round text-3xl">warning</span>
                        </div>
                        <h4 className="text-2xl font-black dark:text-white mb-2">Deseja cancelar a renovação?</h4>
                        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                            Você continuará com acesso a todos os recursos até o dia <b>{subInfo?.current_period_end ? new Date(subInfo.current_period_end * 1000).toLocaleDateString() : 'final do ciclo'}</b>. Após essa data, não haverá novas cobranças.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleCancelSubscription}
                                disabled={isCancelling}
                                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all disabled:opacity-50"
                            >
                                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                            </button>
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Manter Plano
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default SubscriptionView;
