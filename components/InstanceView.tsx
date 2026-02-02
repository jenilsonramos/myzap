
import React, { useState } from 'react';
import StatCard from './StatCard';
import InstanceCard from './InstanceCard';
import { Instance, InstanceStatus } from '../types';

const InstanceView: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  return (

    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom duration-700">
      {/* High-Level Summaries */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 md:gap-6">
        <StatCard
          label="Instâncias Totais"
          value="0"
          icon="view_compact"
          colorClass="text-indigo-600 dark:text-indigo-400"
          bgClass="bg-white dark:bg-card-dark shadow-sm"
        />
        <StatCard
          label="Operacionais"
          value="0"
          icon="sync_lock"
          colorClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-white dark:bg-card-dark shadow-sm"
        />
        <StatCard
          label="Em Pausa"
          value="0"
          icon="pause_circle"
          colorClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-white dark:bg-card-dark shadow-sm"
        />
        <StatCard
          label="Alertas Críticos"
          value="0"
          icon="emergency"
          colorClass="text-rose-600 dark:text-rose-400"
          bgClass="bg-white dark:bg-card-dark shadow-sm"
        />

      </section>

      {/* Main Instance Dashboard */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black dark:text-white flex items-center gap-3">
            <span className="w-1.5 h-8 bg-primary rounded-full"></span>
            Suas Conexões
          </h2>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card-dark rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm hover:text-primary transition-colors">
              <span className="material-icons-round text-lg">filter_list</span>
              Filtrar
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-24 md:pb-12">
          {instances.map(instance => (
            <InstanceCard key={instance.id} instance={instance} />
          ))}

          <button className="border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-huge p-8 flex flex-col items-center justify-center gap-5 group hover:border-primary hover:bg-primary/5 transition-all duration-500 min-h-[320px] bg-white/30 dark:bg-transparent">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-md group-hover:rotate-12 active:scale-90">
              <span className="material-icons-round text-4xl">add</span>
            </div>
            <div className="text-center">
              <p className="font-black text-xl dark:text-white group-hover:text-primary transition-colors">Nova Instância</p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Conectar novo WhatsApp</p>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
};

export default InstanceView;
