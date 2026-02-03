import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const SubscriptionView: React.FC = () => {
    const { showToast } = useToast();

    const user = JSON.parse(localStorage.getItem('myzap_user') || '{}');
    const isTrial = user.plan === 'Teste Grátis';

    // Parse trial_ends_at robustly, fallback to null instead of hardcoded 7 days
    const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const initialExpiry = parseDate(user.trial_ends_at);

    const [plans, setPlans] = useState<any[]>([]);
    const [planData, setPlanData] = useState({
        name: user.plan || 'Plano Professional',
        status: isTrial ? 'Período de Teste' : 'Assinatura Ativa',
        expiryDate: initialExpiry || new Date(), // Fallback to now if null to avoid crash, but will be updated by API
        limits: {
            instances: { used: 0, total: 10 },
            messages: { used: 0, total: 100000 },
            webhooks: { used: 0, total: 20 },
            aiNodes: { used: 0, total: 50 }
        }
    });

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
                });
                if (response.ok) {
                    const updatedUser = await response.json();
                    localStorage.setItem('myzap_user', JSON.stringify(updatedUser));

                    const newExpiry = parseDate(updatedUser.trial_ends_at);
                    const newPlan = updatedUser.plan || 'Plano Professional';
                    const newStatus = updatedUser.plan === 'Teste Grátis' ? 'Período de Teste' : 'Assinatura Ativa';

                    setPlanData(prev => ({
                        ...prev,
                        name: newPlan,
                        expiryDate: newExpiry || prev.expiryDate,
                        status: newStatus
                    }));
                    window.dispatchEvent(new Event('profileUpdate'));
                }
            } catch (err) {
                console.error('Erro ao sincronizar dados do usuário:', err);
            }
        };

        const fetchPlans = async () => {
            try {
                const response = await fetch('/api/plans');
                if (response.ok) {
                    const data = await response.json();
                    setPlans(data);

                    const currentPlan = data.find((p: any) => p.name === user.plan);
                    if (currentPlan) {
                        setPlanData(prev => ({
                            ...prev,
                            name: currentPlan.name,
                            limits: {
                                ...prev.limits,
                                instances: { ...prev.limits.instances, total: currentPlan.instances },
                                messages: { ...prev.limits.messages, total: currentPlan.messages },
                                aiNodes: { ...prev.limits.aiNodes, total: currentPlan.ai_nodes || currentPlan.aiNodes }
                            }
                        }));
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar planos:', err);
            }
        };
        fetchUserData();
        fetchPlans();
    }, []); // Empty dependency array to force sync on mount

    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +planData.expiryDate - +new Date();
            let timeLeftObj = {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0
            };

            if (difference > 0) {
                timeLeftObj = {
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                };
            }
            setTimeLeft(timeLeftObj);
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft(); // Run once immediately

        return () => clearInterval(timer);
    }, [planData.expiryDate]);

    const handleUpgrade = (plano: string) => {
        showToast(`Redirecionando para o upgrade: ${plano}`, 'info');
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Top Section: Hero Card & Countdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-huge p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[300px] shadow-2xl shadow-indigo-600/20">
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit mb-4">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_white]"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{planData.status}</span>
                            </div>
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter mb-2">{planData.name}</h2>
                            <p className="text-indigo-100 text-sm font-medium opacity-80">Você está aproveitando o máximo de recursos da nossa plataforma.</p>
                        </div>
                        <div className="hidden sm:flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 rotate-12">
                            <span className="material-icons-round text-5xl">workspace_premium</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-8 relative z-10">
                        <button
                            onClick={() => handleUpgrade('Anual')}
                            className="bg-white text-indigo-700 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                        >
                            Ver Próximos Planos
                        </button>
                        <button className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-white/20 transition-all">
                            Baixar Fatura
                        </button>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl"></div>
                </div>

                <div className="lg:col-span-4 bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-6">Tempo Restante de Plano</p>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-inner">
                                <span className="text-2xl font-black text-slate-800 dark:text-white">{String(timeLeft.days).padStart(2, '0')}</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-2">Dias</span>
                        </div>
                        <span className="text-2xl font-black text-slate-300 dark:text-slate-700 -mt-6">:</span>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-inner">
                                <span className="text-2xl font-black text-slate-800 dark:text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-2">Horas</span>
                        </div>
                        <span className="text-2xl font-black text-slate-300 dark:text-slate-700 -mt-6">:</span>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-inner">
                                <span className="text-2xl font-black text-slate-800 dark:text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-2">Mins</span>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="material-icons-round text-slate-400 text-lg">event</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Renova em: {planData.expiryDate.toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Middle Section: Usage Limits */}
            <div className="bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Limites do Plano</h3>
                        <p className="text-slate-500 text-sm font-medium">Acompanhe seu consumo em tempo real</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                        <span className="material-icons-round">analytics</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Progress Bar 1 */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                                    <span className="material-icons-round">hub</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Instâncias</p>
                                    <p className="text-base font-black text-slate-800 dark:text-white mt-1">{planData.limits.instances.used} de {planData.limits.instances.total}</p>
                                </div>
                            </div>
                            <p className="text-sm font-black text-emerald-500">{(planData.limits.instances.used / planData.limits.instances.total * 100).toFixed(0)}%</p>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                                className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                style={{ width: `${(planData.limits.instances.used / planData.limits.instances.total * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Progress Bar 2 */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                    <span className="material-icons-round">message</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Mensagens Mensais</p>
                                    <p className="text-base font-black text-slate-800 dark:text-white mt-1">{planData.limits.messages.used.toLocaleString()} de {planData.limits.messages.total.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-sm font-black text-indigo-500">{(planData.limits.messages.used / planData.limits.messages.total * 100).toFixed(0)}%</p>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                                className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-1000"
                                style={{ width: `${(planData.limits.messages.used / planData.limits.messages.total * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Progress Bar 3 */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                                    <span className="material-icons-round">webhook</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Webhooks Ativos</p>
                                    <p className="text-base font-black text-slate-800 dark:text-white mt-1">{planData.limits.webhooks.used} de {planData.limits.webhooks.total}</p>
                                </div>
                            </div>
                            <p className="text-sm font-black text-amber-500">{(planData.limits.webhooks.used / planData.limits.webhooks.total * 100).toFixed(0)}%</p>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                                className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all duration-1000"
                                style={{ width: `${(planData.limits.webhooks.used / planData.limits.webhooks.total * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Progress Bar 4 */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                                    <span className="material-icons-round">psychology</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Nós de IA Utilizados</p>
                                    <p className="text-base font-black text-slate-800 dark:text-white mt-1">{planData.limits.aiNodes.used} de {planData.limits.aiNodes.total}</p>
                                </div>
                            </div>
                            <p className="text-sm font-black text-rose-500">{(planData.limits.aiNodes.used / planData.limits.aiNodes.total * 100).toFixed(0)}%</p>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div
                                className="h-full bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)] transition-all duration-1000"
                                style={{ width: `${(planData.limits.aiNodes.used / planData.limits.aiNodes.total * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Upgrade Option Boxes */}
            <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-indigo-500 rounded-full"></span>
                    Evolua sua conta
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.filter(p => p.name !== user.plan).map((p: any) => (
                        <div key={p.id} className={`bg-white dark:bg-card-dark rounded-huge p-6 border border-slate-100 dark:border-white/5 shadow-lg group hover:scale-[1.02] transition-all cursor-pointer ${p.name === 'Master IA' ? 'bg-slate-900 dark:bg-indigo-950 border-white/10' : ''}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all ${p.name === 'Master IA' ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-primary group-hover:text-white'}`}>
                                <span className="material-icons-round">{p.name === 'Master IA' ? 'auto_fix_high' : p.name === 'Enterprise' ? 'business' : 'rocket_launch'}</span>
                            </div>
                            <h4 className={`text-lg font-black mb-2 uppercase ${p.name === 'Master IA' ? 'text-white' : 'dark:text-white'}`}>Plano {p.name}</h4>
                            <p className={`text-sm font-medium mb-6 ${p.name === 'Master IA' ? 'text-slate-300' : 'text-slate-500'}`}>
                                {p.name === 'Professional' && 'Ideal para pequenas operações e automações essenciais.'}
                                {p.name === 'Master IA' && 'Tudo ilimitado + Integração direta com GPT-4.'}
                                {p.name === 'Enterprise' && 'Solução robusta para grandes empresas com suporte 24h.'}
                                {p.name === 'Teste Grátis' && 'Experimente nossos recursos por tempo limitado.'}
                            </p>
                            <div className="flex items-baseline gap-1 mb-8">
                                <span className={`text-3xl font-black ${p.name === 'Master IA' ? 'text-white' : 'dark:text-white'}`}>R$ {Math.floor(p.price)}</span>
                                <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">/mês</span>
                            </div>
                            <button
                                onClick={() => handleUpgrade(p.name)}
                                className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${p.name === 'Master IA' ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-xl' : 'border-2 border-slate-100 dark:border-white/5 group-hover:bg-primary group-hover:border-primary group-hover:text-white'}`}
                            >
                                {isTrial ? 'Começar agora' : 'Mudar para este'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionView;
