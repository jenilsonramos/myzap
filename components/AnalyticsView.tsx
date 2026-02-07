import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

type DateFilter = 'today' | 'yesterday' | '7d' | '30d' | 'month';

const AnalyticsView: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('myzap_user') || '{}');
  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const isTrial = user.plan === 'Teste Grátis';
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  // States
  const [filter, setFilter] = useState<DateFilter>('30d');
  const [stats, setStats] = useState<any>({
    totalMessages: 0,
    sentMessages: 0,
    totalContacts: 0,
    weeklyVolume: [],
    hourlyVolume: [],
    pieChart: [],
    avgResponseTime: '0m',
    growth: 0
  });
  const [loading, setLoading] = useState(true);

  // Trial Countdown
  useEffect(() => {
    if (trialEndsAt) {
      const diff = trialEndsAt.getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysLeft(days > 0 ? days : 0);
    }
  }, [user.trial_ends_at]);

  // Fetch Data
  const fetchStats = async (startDate?: Date, endDate?: Date) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('myzap_token');
      let query = '';
      if (startDate && endDate) {
        query = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const res = await fetch(`/api/analytics/dashboard${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Erro ao carregar analytics', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: DateFilter) => {
    setFilter(newFilter);
    const end = new Date();
    const start = new Date();

    switch (newFilter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    fetchStats(start, end);
  };

  // Initial Load
  useEffect(() => {
    handleFilterChange('30d');
  }, []);

  // Helpers
  const pieData = stats.pieChart.length > 0 ? stats.pieChart : [{ name: 'Sem dados', value: 1, color: '#e2e8f0' }];

  // Fill hourly gaps
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const found = stats.hourlyVolume?.find((h: any) => h.hour === i);
    return { hour: i, count: found ? found.count : 0 };
  });

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom duration-500 pb-10">

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight dark:text-white">Visão Geral</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Acompanhe o desempenho do seu atendimento.</p>
        </div>

        <div className="bg-white dark:bg-card-dark p-1 rounded-xl border border-slate-100 dark:border-white/5 flex shadow-sm">
          {([
            { id: 'today', label: 'Hoje' },
            { id: 'yesterday', label: 'Ontem' },
            { id: '7d', label: '7 Dias' },
            { id: '30d', label: '30 Dias' },
            { id: 'month', label: 'Mês Atual' },
          ] as const).map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleFilterChange(btn.id)}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-bold transition-all
                ${filter === btn.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'}
              `}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {isTrial && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Período de Experiência</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">Você tem <span className="text-emerald-400 text-3xl mx-1">{daysLeft}</span> dias de teste grátis restantes!</h2>
              <p className="text-white/80 text-sm font-medium">Aproveite todos os recursos premium do MyZap Pro antes que seu acesso expire.</p>
            </div>
            <button
              onClick={() => window.location.hash = '#/planos'}
              className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-xl whitespace-nowrap"
            >
              Assinar Plano Profissional
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
            <span className="material-icons-round text-[200px]">auto_awesome</span>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          label="Total de Mensagens"
          value={stats.totalMessages.toString()}
          icon="forum"
          colorClass="text-indigo-600 dark:text-indigo-400"
          bgClass="bg-indigo-50 dark:bg-indigo-900/20"
        />
        <StatCard
          label="Mensagens Enviadas"
          value={stats.sentMessages.toString()}
          icon="send"
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <div className="bg-white dark:bg-card-dark p-6 rounded-[2rem] shadow-sm border border-slate-50 dark:border-slate-800 flex items-center justify-between group hover:border-blue-100 transition-colors relative overflow-hidden">
          <div>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Crescimento</p>
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {stats.growth > 0 ? '+' : ''}{stats.growth}%
              <span className={`text-xs px-2 py-0.5 rounded-full ${stats.growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {stats.growth >= 0 ? '▲' : '▼'}
              </span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-icons-round text-2xl">trending_up</span>
          </div>
        </div>
        <StatCard
          label="Conversas Ativas"
          value={stats.totalContacts.toString()}
          icon="chat_bubble_outline"
          colorClass="text-orange-600 dark:text-orange-400"
          bgClass="bg-orange-50 dark:bg-orange-900/20"
        />
      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Volume Diário */}
        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-lg font-bold dark:text-white">Volume de Mensagens</h2>
              <p className="text-slate-400 text-xs font-medium">Quantidade de mensagens por dia</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyVolume}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                />
                <Tooltip
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVolume)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours (Heatmap alternative) */}
        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-lg font-bold dark:text-white">Horários de Pico</h2>
              <p className="text-slate-400 text-xs font-medium">Intensidade de mensagens por hora</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(val) => `${val}h`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelFormatter={(val) => `${val}:00 - ${val}:59`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.count > 0 ? `rgba(59, 130, 246, ${Math.max(0.3, Math.min(1, entry.count / 50))})` : '#f1f5f9'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-slate-800 md:col-span-1">
          <h2 className="text-lg font-bold dark:text-white mb-6">Status</h2>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-slate-400">Total</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalMessages}</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {pieData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                </div>
                <span className="text-sm font-bold dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State / Additional Info */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-slate-800/50">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <span className="material-icons-round text-3xl text-blue-500">insights</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Insights Inteligentes</h3>
          <p className="text-slate-500 max-w-md">
            Baseado no seu histórico, seus clientes respondem melhor entre <span className="font-bold text-slate-700 dark:text-slate-300">14h e 16h</span>.
            Tente agendar suas campanhas para este horário para aumentar a conversão.
          </p>
        </div>
      </section>

    </div>
  );
};
export default AnalyticsView;
