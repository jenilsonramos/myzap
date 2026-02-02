
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

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          label="Total de Mensagens"
          value="0"
          icon="forum"
          colorClass="text-indigo-600 dark:text-indigo-400"
          bgClass="bg-indigo-50 dark:bg-indigo-900/20"
        />
        <StatCard
          label="Mensagens Enviadas"
          value="0"
          icon="send"
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          label="Tempo Médio"
          value="0"
          icon="timer"
          colorClass="text-pink-600 dark:text-pink-400"
          bgClass="bg-pink-50 dark:bg-pink-900/20"
        />
        <StatCard
          label="Conversas Ativas"
          value="0"
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
              {PIE_DATA.map((item) => (
                <div key={item.name} className="flex items-center space-x-3 group">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-sm font-bold dark:text-white tabular-nums">
                    {item.value}%
                    <span className="text-slate-400 font-medium ml-2">{item.name}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="relative w-48 h-48 md:w-56 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PIE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {PIE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-wider">Total Mensagens</span>
                <span className="text-xl md:text-2xl font-black dark:text-white tabular-nums">2,500k</span>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BAR_DATA}>
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
                  {BAR_DATA.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.special ? '#22c55e' : '#22c55e33'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom Charts Row */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-20 md:pb-6">
        <div className="xl:col-span-2 bg-white dark:bg-card-dark p-6 md:p-8 rounded-huge shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold dark:text-white">Tendências de Atendimento</h2>
            <div className="flex items-center space-x-2 text-[10px] font-bold px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-xl cursor-pointer">
              <span>Mensal</span>
              <span className="material-icons-round text-sm">expand_more</span>
            </div>
          </div>
          <div className="h-56 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA}>
                <defs>
                  <linearGradient id="colorCur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCur)"
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-huge shadow-sm border border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold dark:text-white">Tipos de Chamada</h2>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <span className="material-icons-round">more_horiz</span>
            </button>
          </div>
          <div className="flex items-center justify-center h-48 space-x-[-15px] md:space-x-[-25px]">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-purple-500/80 flex items-center justify-center text-white text-[10px] font-black shadow-lg z-0 transition-transform hover:scale-110 cursor-pointer">10%</div>
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg md:text-2xl font-black shadow-2xl z-20 border-4 border-white dark:border-card-dark transition-transform hover:scale-110 cursor-pointer">70%</div>
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-secondary flex items-center justify-center text-white text-xs md:text-base font-black shadow-lg z-10 transition-transform hover:scale-110 cursor-pointer">20%</div>
          </div>
          <div className="mt-8 space-y-3">
            {[
              { label: 'Respondidas', val: '70%', color: 'bg-indigo-600' },
              { label: 'Transmissão', val: '20%', color: 'bg-secondary' },
              { label: 'Instantâneas', val: '10%', color: 'bg-purple-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{item.label}</span>
                </div>
                <span className="font-bold dark:text-white">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsView;
