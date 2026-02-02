import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const GoogleSheetsNode = ({ data, selected }: any) => {
    return (
        <div className={`w-72 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-green-400 to-emerald-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-green-400/50 shadow-[0_8px_30px_-6px_rgba(34,197,94,0.15)] ring-1 ring-green-400/20' : 'border-slate-200 dark:border-white/5 hover:border-green-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0 border border-green-200/50 dark:border-green-500/10">
                        <span className="material-icons-round text-green-600 dark:text-green-400 text-sm">table_chart</span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Sheets</span>
                        <span className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">{data.operation === 'write' ? 'Escrever' : 'Ler Linha'}</span>
                    </div>
                </div>

                <div className="p-4 px-5 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Range</span>
                    <code className="text-xs font-mono text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded border border-green-100 dark:border-green-500/20">{data.range || 'A:Z'}</code>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-green-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(GoogleSheetsNode);
