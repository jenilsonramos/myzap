import React, { useState, useEffect } from 'react';

interface HealthData {
    current: {
        cpu_usage: number;
        ram_usage: number;
        ram_used_mb: number;
        ram_total_mb: number;
        classification: 'boa' | 'estavel' | 'ruim' | 'pessima';
    };
    peak: {
        timestamp: string;
        cpu_usage: number;
        ram_usage: number;
    } | null;
    uptime: number;
    cronLogs: {
        cron_name: string;
        last_execution: string;
        next_execution: string;
        status: string;
        details: string;
    }[];
}

const ServerHealthView: React.FC = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchHealth = async () => {
        try {
            const token = localStorage.getItem('myzap_token');
            const res = await fetch('/api/admin/server-health', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Erro ao buscar dados');
            setHealth(await res.json());
            setError('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Atualiza a cada 30s
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${mins}m`;
    };

    const getClassificationColor = (c: string) => {
        switch (c) {
            case 'boa': return 'text-emerald-500 bg-emerald-500/10';
            case 'estavel': return 'text-blue-500 bg-blue-500/10';
            case 'ruim': return 'text-amber-500 bg-amber-500/10';
            case 'pessima': return 'text-red-500 bg-red-500/10';
            default: return 'text-slate-500 bg-slate-500/10';
        }
    };

    const getClassificationLabel = (c: string) => {
        switch (c) {
            case 'boa': return 'Boa';
            case 'estavel': return 'Estável';
            case 'ruim': return 'Ruim';
            case 'pessima': return 'Péssima';
            default: return c;
        }
    };

    const getCronLabel = (name: string) => {
        switch (name) {
            case 'check_subscriptions': return 'Verificar Assinaturas (01:00)';
            case 'send_expired_email': return 'Email Assinatura Vencida (09:00)';
            case 'notify_expiring_plans': return 'Notificar Planos Expirando (14:00)';
            case 'update_trial_days': return 'Atualizar Trials (00:00)';
            default: return name;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="material-icons-round text-6xl text-red-400 mb-4">error</span>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Erro ao carregar</h3>
                <p className="text-slate-500">{error}</p>
                <button onClick={fetchHealth} className="mt-4 px-6 py-2 bg-primary text-white rounded-xl">
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                        <span className="material-icons-round text-white text-2xl">monitor_heart</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white">Saúde do Servidor</h2>
                        <p className="text-slate-500 text-sm">Monitoramento em tempo real do sistema</p>
                    </div>
                </div>
            </div>

            {/* Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* CPU */}
                <div className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-xl border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 text-sm font-medium">CPU</span>
                        <span className="material-icons-round text-blue-500">memory</span>
                    </div>
                    <div className="text-3xl font-bold dark:text-white mb-2">
                        {health?.current.cpu_usage.toFixed(1)}%
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(health?.current.cpu_usage || 0, 100)}%` }}
                        />
                    </div>
                </div>

                {/* RAM */}
                <div className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-xl border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 text-sm font-medium">RAM</span>
                        <span className="material-icons-round text-violet-500">memory</span>
                    </div>
                    <div className="text-3xl font-bold dark:text-white mb-2">
                        {health?.current.ram_usage.toFixed(1)}%
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                        <div
                            className="bg-violet-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(health?.current.ram_usage || 0, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        {health?.current.ram_used_mb} MB / {health?.current.ram_total_mb} MB
                    </p>
                </div>

                {/* Classificação */}
                <div className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-xl border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 text-sm font-medium">Status</span>
                        <span className="material-icons-round text-emerald-500">speed</span>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-bold ${getClassificationColor(health?.current.classification || '')}`}>
                        {getClassificationLabel(health?.current.classification || '')}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Uptime: {formatUptime(health?.uptime || 0)}
                    </p>
                </div>
            </div>

            {/* Pico */}
            {health?.peak && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-icons-round text-amber-500">trending_up</span>
                        <h3 className="font-bold text-amber-700 dark:text-amber-400">Maior Pico Registrado</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-slate-500">Data/Hora</p>
                            <p className="font-medium dark:text-white">
                                {new Date(health.peak.timestamp).toLocaleString('pt-BR')}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500">CPU</p>
                            <p className="font-medium dark:text-white">{health.peak.cpu_usage}%</p>
                        </div>
                        <div>
                            <p className="text-slate-500">RAM</p>
                            <p className="font-medium dark:text-white">{health.peak.ram_usage}%</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CRONs */}
            <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                    <span className="material-icons-round text-primary">schedule</span>
                    <h3 className="font-bold text-lg dark:text-white">Tarefas Agendadas (CRONs)</h3>
                </div>

                {(health?.cronLogs?.length || 0) === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                        Nenhum CRON executado ainda. As tarefas serão exibidas após a primeira execução.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {health?.cronLogs.map((cron, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-medium dark:text-white">{getCronLabel(cron.cron_name)}</p>
                                    <p className="text-xs text-slate-500">
                                        Último: {cron.last_execution ? new Date(cron.last_execution).toLocaleString('pt-BR') : 'Nunca'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${cron.status === 'success' ? 'bg-emerald-100 text-emerald-600' : cron.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {cron.status === 'success' ? 'Sucesso' : cron.status === 'error' ? 'Erro' : cron.status}
                                    </span>
                                    {cron.details && (
                                        <p className="text-xs text-slate-500 mt-1">{cron.details}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServerHealthView;
