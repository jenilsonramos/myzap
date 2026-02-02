import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ActionNode = ({ data, selected }: any) => {
    return (
        <div className={`w-64 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-blue-400 to-indigo-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-blue-400/50 shadow-[0_8px_30px_-6px_rgba(59,130,246,0.15)] ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-white/5 hover:border-blue-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-500/10">
                        <span className="material-icons-round text-blue-600 dark:text-blue-400 text-sm">bolt</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Ação</span>
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Tag:</span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate flex-1">{data.tag || '...'}</span>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-blue-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(ActionNode);
