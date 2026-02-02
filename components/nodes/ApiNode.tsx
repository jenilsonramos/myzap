import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ApiNode = ({ data, selected }: any) => {
    const methodColor = {
        GET: 'text-blue-600 bg-blue-100 dark:bg-blue-500/20',
        POST: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20',
        PUT: 'text-amber-600 bg-amber-100 dark:bg-amber-500/20',
        DELETE: 'text-rose-600 bg-rose-100 dark:bg-rose-500/20'
    }[data.method || 'GET'];

    return (
        <div className={`w-72 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-violet-400/50 shadow-[0_8px_30px_-6px_rgba(139,92,246,0.15)] ring-1 ring-violet-400/20' : 'border-slate-200 dark:border-white/5 hover:border-violet-300/30'}`}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0 border border-violet-200/50 dark:border-violet-500/10">
                            <span className="material-icons-round text-violet-600 dark:text-violet-400 text-sm">hub</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">API</span>
                    </div>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${methodColor}`}>{data.method || 'GET'}</span>
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                        <span className="material-icons-round text-slate-400 text-xs">link</span>
                        <code className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate flex-1">{data.url || 'https://...'}</code>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-violet-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(ApiNode);
