import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const InputNode = ({ data, selected }: any) => {
    return (
        <div className={`w-80 group transition-all duration-300 relative`}>
            <div className={`bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-orange-400/50 shadow-[0_8px_30px_-6px_rgba(251,146,60,0.15)] ring-2 ring-orange-400/30' : 'border-slate-200 dark:border-white/10 hover:border-orange-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-200/50 dark:border-orange-500/10">
                        <span className="material-icons-round text-orange-600 dark:text-orange-400 text-sm">keyboard_alt</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Entrada</span>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-[13px] text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap">{data.question || 'Pergunta...'}</p>

                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Var:</span>
                        <code className="text-xs font-mono text-orange-600 dark:text-orange-400 font-bold">{data.variable || 'variável'}</code>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-orange-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(InputNode);
