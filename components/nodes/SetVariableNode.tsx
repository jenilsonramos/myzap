import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const SetVariableNode = ({ data, selected }: any) => {
    return (
        <div className={`w-64 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-teal-400 to-cyan-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-teal-400/50 shadow-[0_8px_30px_-6px_rgba(45,212,191,0.15)] ring-1 ring-teal-400/20' : 'border-slate-200 dark:border-white/5 hover:border-teal-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center shrink-0 border border-teal-200/50 dark:border-teal-500/10">
                        <span className="material-icons-round text-teal-600 dark:text-teal-400 text-sm">data_object</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Variável</span>
                </div>

                <div className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-black tracking-widest px-1">
                        <span>Var</span>
                        <span>Val</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-white/5 rounded-lg p-2 border border-slate-200/50 dark:border-white/5">
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 truncate flex-1">{data.variableName || '...'}</span>
                        <span className="material-icons-round text-slate-300 text-[10px]">arrow_forward</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate flex-1 text-right">{data.value || '...'}</span>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-teal-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(SetVariableNode);
