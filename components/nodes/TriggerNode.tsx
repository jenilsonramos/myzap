import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TriggerNode = ({ data, selected }: any) => {
    return (
        <div className={`w-72 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-emerald-400 to-green-400 rounded-[26px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-emerald-500/5 dark:bg-emerald-900/10 backdrop-blur-xl rounded-[24px] shadow-sm border transition-all ${selected ? 'border-emerald-400/50 shadow-[0_8px_30px_-6px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/20' : 'border-emerald-200 dark:border-emerald-800/30 hover:border-emerald-400/40'}`}>

                <div className="px-5 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center shrink-0 text-white">
                        <span className="material-icons-round text-xl">play_arrow</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block mb-0.5">Início</span>
                        <p className="text-sm font-bold text-slate-700 dark:text-white truncate max-w-[140px]">
                            {data.keyword ? `"${data.keyword}"` : "Qualquer Msg"}
                        </p>
                    </div>
                </div>

                <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white dark:!border-slate-900 transition-all hover:scale-110 !-right-2" />
            </div>
        </div>
    );
};

export default memo(TriggerNode);
