
import React from 'react';
import { Instance, InstanceStatus } from '../types';

interface InstanceCardProps {
  instance: Instance;
}

const InstanceCard: React.FC<InstanceCardProps> = ({ instance }) => {
  const getStatusColor = (status: InstanceStatus) => {
    switch (status) {
      case InstanceStatus.CONNECTED: return 'bg-emerald-500';
      case InstanceStatus.DISCONNECTED: return 'bg-rose-500';
      case InstanceStatus.INITIALIZING: return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusBg = (status: InstanceStatus) => {
    switch (status) {
      case InstanceStatus.CONNECTED: return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case InstanceStatus.DISCONNECTED: return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400';
      case InstanceStatus.INITIALIZING: return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
      default: return 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400';
    }
  };

  const instanceAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${instance.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-huge p-6 shadow-sm border border-slate-100 dark:border-slate-800/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden flex flex-col justify-between">
      {/* Glossy Overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/20 to-transparent -mr-16 -mt-16 rounded-full blur-2xl group-hover:bg-primary/5 transition-all"></div>
      
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-white dark:border-slate-700">
                <img src={instanceAvatar} alt={instance.name} className="w-full h-full object-cover" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getStatusColor(instance.status)} border-4 border-white dark:border-card-dark rounded-full shadow-lg`}></div>
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg dark:text-white truncate group-hover:text-primary transition-colors">{instance.name}</h3>
              <p className="text-xs text-slate-400 font-bold tracking-tight opacity-70 uppercase tracking-widest">{instance.id.split('_').pop()}</p>
            </div>
          </div>
          <button className="text-slate-300 hover:text-primary transition-colors p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="material-icons-round text-xl">more_vert</span>
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</span>
            <span className={`px-3 py-1 ${getStatusBg(instance.status)} text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm`}>
              {instance.status}
            </span>
          </div>
          <div className="flex items-center justify-between px-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Bateria</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black dark:text-white tabular-nums ${instance.batteryLevel !== null && instance.batteryLevel <= 20 ? 'text-rose-500' : ''}`}>
                {instance.batteryLevel !== null ? `${instance.batteryLevel}%` : '-- %'}
              </span>
              <span className={`material-icons-round text-xl ${instance.batteryLevel !== null && instance.batteryLevel <= 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>
                {instance.batteryLevel === null ? 'battery_unknown' : (instance.batteryLevel > 80 ? 'battery_full' : (instance.batteryLevel > 20 ? 'battery_4_bar' : 'battery_1_bar'))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto">
        <button className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-wider">
          <span className="material-icons-round text-lg">settings_ethernet</span>
          Config
        </button>
        {instance.status === InstanceStatus.DISCONNECTED ? (
          <button className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-primary text-white text-xs font-black hover:brightness-110 transition-all shadow-lg shadow-primary/30 active:scale-95 uppercase tracking-wider">
            <span className="material-icons-round text-lg">sensors</span>
            Ativar
          </button>
        ) : (
          <button className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 uppercase tracking-wider">
            <span className="material-icons-round text-lg">qr_code_scanner</span>
            QR Code
          </button>
        )}
      </div>
    </div>
  );
};

export default InstanceCard;
