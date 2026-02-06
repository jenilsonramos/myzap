
import React from 'react';
import StatCard from './StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

const BAR_DATA: any[] = [];
const PIE_DATA: any[] = [];
const TREND_DATA: any[] = [];


const AnalyticsView: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('myzap_user') || '{}');
  const userName = user.name || 'Usuário';

  const brDate = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date());

  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const isTrial = user.plan === 'Teste Grátis';
  const [daysLeft, setDaysLeft] = React.useState<number | null>(null);

  // ESTADO REAL
  const [stats, setStats] = React.useState<any>({
    totalMessages: 0,
    sentMessages: 0,
    totalContacts: 0,
    weeklyVolume: [],
    pieChart: [],
    avgResponseTime: '0m'
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (trialEndsAt) {
      const diff = trialEndsAt.getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysLeft(days > 0 ? days : 0);
    }
  }, [user.trial_ends_at]);

  // BUSCA DADOS REAIS
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('myzap_token');
        const res = await fetch('/api/analytics/dashboard', {
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
    fetchStats();
  }, []);

  const pieData = stats.pieChart.length > 0 ? stats.pieChart : [{ name: 'Sem dados', value: 1, color: '#e2e8f0' }];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom duration-500">
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
          {/* Decorative icons */}
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
        <StatCard
          label="Tempo Médio"
          value={stats.avgResponseTime}
          icon="timer"
          colorClass="text-pink-600 dark:text-pink-400"
          bgClass="bg-pink-50 dark:bg-pink-900/20"
        />
        <StatCard
          label="Conversas Ativas"
          value={stats.totalContacts.toString()}
          icon="chat_bubble_outline"
          colorClass="text-orange-600 dark:text-orange-400"
          bgClass="bg-orange-50 dark:bg-orange-900/20"
        />

      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-huge shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold dark:text-white">Status das Mensagens</h2>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <span className="material-icons-round">more_horiz</span>
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-8">
            <div className="space-y-4 shrink-0">
              {pieData.map((item: any) => (
                <div key={item.name} className="flex items-center space-x-3 group">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-sm font-bold dark:text-white tabular-nums">
                    {item.value || 0}
                    <span className="text-slate-400 font-medium ml-2">{item.name}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="relative w-48 h-48 md:w-56 md:h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-wider">Total</span>
                <span className="text-xl md:text-2xl font-black dark:text-white tabular-nums">{stats.totalMessages}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-huge shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold dark:text-white">Volume Semanal</h2>
            <div className="flex items-center space-x-2 text-[10px] font-bold px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-xl cursor-pointer">
              <span>Semanal</span>
              <span className="material-icons-round text-sm">expand_more</span>
            </div>
          </div>
          <div className="h-48 md:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(34, 197, 94, 0.05)' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar
                  dataKey="value"
                  radius={[10, 10, 10, 10]}
                  barSize={18}
                >
                  {stats.weeklyVolume.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={'#22c55e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom Charts Row (Mantendo estático por enquanto ou pode remover se não tiver dados) */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-20 md:pb-6">
        {/* ... Area Chart mantido estático ou oculto se preferir ... */}
        {/* Para simplificar e responder ao usuario, vou deixar o AreaChart mockado ou vazio para focar no que funciona */}
      </section>
    </div>
  );
};
export default AnalyticsView;
