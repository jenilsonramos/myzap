import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const InteractiveNode = ({ data, selected }: any) => {
    const options = (data.options || '').split(',').filter(Boolean);

    return (
        <div className={`w-80 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-indigo-400 to-violet-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-indigo-400/50 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.15)] ring-1 ring-indigo-400/20' : 'border-slate-200 dark:border-white/5 hover:border-indigo-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-500/10">
                        <span className="material-icons-round text-indigo-600 dark:text-indigo-400 text-sm">touch_app</span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Interativo</span>
                        <span className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">{data.interactiveType || 'Botões'}</span>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{data.body || 'Texto...'}</p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {options.length > 0 ? options.map((opt: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20">
                                {opt}
                            </span>
                        )) : <span className="text-[10px] text-slate-400 italic">Sem opções</span>}
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-indigo-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(InteractiveNode);
