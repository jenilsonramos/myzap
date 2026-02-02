import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ConditionNode = ({ data, selected }: any) => {
    return (
        <div className={`w-64 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-amber-400 to-orange-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-amber-400/50 shadow-[0_8px_30px_-6px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20' : 'border-slate-200 dark:border-white/5 hover:border-amber-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-500/10">
                        <span className="material-icons-round text-amber-600 dark:text-amber-400 text-sm">call_merge</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Condição</span>
                </div>

                <div className="p-4 flex items-center justify-center">
                    <code className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 text-xs font-mono text-amber-700 dark:text-amber-400 truncate max-w-full">
                        {data.rule || 'x == y'}
                    </code>
                </div>

                {/* Outputs */}
                <div className="absolute -right-3 top-10 flex flex-col gap-4">
                    <div className="relative group/true flex items-center">
                        <span className="absolute right-4 text-[9px] font-bold text-emerald-500 uppercase opacity-0 group-hover/true:opacity-100 transition-opacity bg-white dark:bg-slate-900 px-1 py-0.5 rounded shadow-sm border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap">Verdadeiro</span>
                        <Handle type="source" position={Position.Right} id="true" className="!relative !left-0 !transform-none !w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-black hover:scale-125 transition-transform" />
                    </div>
                </div>
                <div className="absolute -right-3 bottom-10 flex flex-col gap-4">
                    <div className="relative group/false flex items-center">
                        <span className="absolute right-4 text-[9px] font-bold text-rose-500 uppercase opacity-0 group-hover/false:opacity-100 transition-opacity bg-white dark:bg-slate-900 px-1 py-0.5 rounded shadow-sm border border-rose-100 dark:border-rose-900/30 whitespace-nowrap">Falso</span>
                        <Handle type="source" position={Position.Right} id="false" className="!relative !left-0 !transform-none !w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-black hover:scale-125 transition-transform" />
                    </div>
                </div>


                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-amber-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(ConditionNode);
