import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const SwitchNode = ({ data, selected }: any) => {
    const cases = typeof data.cases === 'string'
        ? data.cases.split(',').map((c: string) => c.trim()).filter(Boolean)
        : (data.cases || []);

    return (
        <div className={`min-w-[240px] group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-pink-400 to-rose-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-pink-400/50 shadow-[0_8px_30px_-6px_rgba(244,114,182,0.15)] ring-1 ring-pink-400/20' : 'border-slate-200 dark:border-white/5 hover:border-pink-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-500/20 flex items-center justify-center shrink-0 border border-pink-200/50 dark:border-pink-500/10">
                        <span className="material-icons-round text-pink-600 dark:text-pink-400 text-sm">hub</span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Switch</span>
                        <code className="text-[10px] font-mono text-pink-500 mt-1 truncate max-w-[120px]">{data.variable || '$var'}</code>
                    </div>
                </div>

                <div className="py-2">
                    {cases.map((option: string, index: number) => (
                        <div key={index} className="relative flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate pr-6">{option}</span>
                            <Handle type="source" position={Position.Right} id={`case-${index}`} className="!relative !left-0 !transform-none !w-2.5 !h-2.5 !bg-pink-500 !border-2 !border-white dark:!border-black" />
                        </div>
                    ))}
                    <div className="relative flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-t border-slate-50 dark:border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Padrão</span>
                        <Handle type="source" position={Position.Right} id="default" className="!relative !left-0 !transform-none !w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white dark:!border-black" />
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-pink-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(SwitchNode);
