import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ScheduleNode = ({ data, selected }: any) => {
    return (
        <div className={`w-56 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-rose-400 to-red-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-rose-400/50 shadow-[0_8px_30px_-6px_rgba(244,63,94,0.15)] ring-1 ring-rose-400/20' : 'border-slate-200 dark:border-white/5 hover:border-rose-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-200/50 dark:border-rose-500/10">
                        <span className="material-icons-round text-rose-500 text-sm">schedule</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Agendar</span>
                </div>

                <div className="p-4 flex flex-col items-center">
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tighter">{data.time || '09:00'}</span>
                    <div className="flex gap-0.5 mt-2">
                        {['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].map(day => (
                            <div key={day} className={`w-1 h-1 rounded-full ${data.days?.includes(day) ? 'bg-rose-500' : 'bg-slate-200 dark:bg-white/10'}`}></div>
                        ))}
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-rose-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(ScheduleNode);
