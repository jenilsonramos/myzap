import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const DelayNode = ({ data, selected }: any) => {
    return (
        <div className={`w-40 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-slate-400 to-gray-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all flex items-center p-3 gap-3 ${selected ? 'border-slate-400/50 shadow-[0_8px_30px_-6px_rgba(148,163,184,0.15)] ring-1 ring-slate-400/20' : 'border-slate-200 dark:border-white/5 hover:border-slate-300/30'}`}>

                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-500/20 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-500/10">
                    <span className="material-icons-round text-slate-500 dark:text-slate-400">hourglass_empty</span>
                </div>

                <div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-none block">{data.delay || 0}s</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Espera</span>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-slate-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(DelayNode);
