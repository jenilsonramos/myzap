import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ValidatorNode = ({ data, selected }: any) => {
    return (
        <div className={`w-64 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-teal-400 to-emerald-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-teal-400/50 shadow-[0_8px_30px_-6px_rgba(45,212,191,0.15)] ring-1 ring-teal-400/20' : 'border-slate-200 dark:border-white/5 hover:border-teal-300/30'}`}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center shrink-0 border border-teal-200/50 dark:border-teal-500/10">
                            <span className="material-icons-round text-teal-600 dark:text-teal-400 text-sm">rule</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Validar</span>
                    </div>
                    <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase">{data.validationType || 'Email'}</span>
                </div>

                <div className="absolute -right-3 top-10 flex flex-col gap-4">
                    <div className="relative group/valid flex items-center">
                        <span className="absolute right-4 text-[9px] font-bold text-emerald-500 uppercase opacity-0 group-hover/valid:opacity-100 transition-opacity bg-white px-1 py-0.5 rounded shadow-sm border border-emerald-100">Ok</span>
                        <Handle type="source" position={Position.Right} id="valid" className="!relative !left-0 !transform-none !w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white dark:!border-black" />
                    </div>
                </div>
                <div className="absolute -right-3 bottom-10 flex flex-col gap-4">
                    <div className="relative group/invalid flex items-center">
                        <span className="absolute right-4 text-[9px] font-bold text-rose-500 uppercase opacity-0 group-hover/invalid:opacity-100 transition-opacity bg-white px-1 py-0.5 rounded shadow-sm border border-rose-100">Erro</span>
                        <Handle type="source" position={Position.Right} id="invalid" className="!relative !left-0 !transform-none !w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-white dark:!border-black" />
                    </div>
                </div>

                <div className="h-14"></div> {/* Spacer for handles */}

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-teal-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(ValidatorNode);
