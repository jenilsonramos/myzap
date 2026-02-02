import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const AiAgentNode = ({ data, selected }: any) => {
    return (
        <div className={`w-80 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-indigo-500 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-purple-400/50 shadow-[0_8px_30px_-6px_rgba(168,85,247,0.15)] ring-1 ring-purple-400/20' : 'border-slate-200 dark:border-white/5 hover:border-purple-300/30'}`}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-center shrink-0 border border-purple-200/50 dark:border-purple-500/10">
                            <span className="material-icons-round text-transparent bg-clip-text bg-gradient-to-br from-purple-600 to-indigo-600 text-sm">auto_awesome</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Agente IA</span>
                    </div>
                    <span className="text-[9px] font-bold text-purple-500 uppercase px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-500/20">{data.model || 'Gemini'}</span>
                </div>

                <div className="p-4 relative min-h-[60px]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 italic">
                        "{data.prompt || 'Instruções do sistema...'}"
                    </p>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-purple-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(AiAgentNode);
