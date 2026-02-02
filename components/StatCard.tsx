
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, colorClass, bgClass, trend }) => {
  return (
    <div className={`${bgClass} p-5 md:p-6 rounded-huge flex items-center justify-between relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-white/10`}>
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-12 h-12 md:w-14 md:h-14 ${colorClass.replace('text-', 'bg-').split(' ')[0]}/20 ${colorClass} rounded-2xl flex items-center justify-center shadow-sm`}>
          <span className="material-icons-round text-2xl md:text-3xl">{icon}</span>
        </div>
        <div>
          <p className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${colorClass} opacity-70 mb-1`}>
            {label}
          </p>
          <p className="text-xl md:text-2xl font-black dark:text-white tabular-nums tracking-tight">
            {value}
          </p>
        </div>
      </div>
      
      {trend && (
        <span className={`text-[10px] md:text-xs font-bold px-2 py-1 rounded-full text-white self-start relative z-10 ${trend.positive ? 'bg-secondary' : 'bg-rose-500'}`}>
          {trend.value}
        </span>
      )}

      {/* Background Graphic */}
      <span className={`material-icons-round absolute -right-4 -bottom-4 text-7xl md:text-8xl opacity-[0.03] dark:opacity-[0.07] ${colorClass} group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500`}>
        {icon}
      </span>
    </div>
  );
};

export default StatCard;
