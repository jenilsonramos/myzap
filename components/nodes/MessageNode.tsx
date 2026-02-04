import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const MessageNode = ({ data, selected }: any) => {
    const isMedia = data.messageType === 'media';

    return (
        <div className={`w-80 group transition-all duration-300`}>
            {/* Glow Effect on Selection */}
            <div className={`absolute -inset-[1px] bg-gradient-to-r ${isMedia ? 'from-cyan-400 to-sky-400' : 'from-blue-400 to-indigo-400'} rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all overflow-hidden ${selected ? (isMedia ? 'border-cyan-400/50 shadow-[0_8px_30px_-6px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/20' : 'border-blue-400/50 shadow-[0_8px_30px_-6px_rgba(59,130,246,0.15)] ring-1 ring-blue-400/20') : 'border-slate-200 dark:border-white/5 hover:border-blue-300/30'}`}>

                {/* Header Compacto */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className={`w-8 h-8 rounded-full ${isMedia ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-200/50' : 'bg-blue-100 dark:bg-blue-500/20 border-blue-200/50'} flex items-center justify-center shrink-0 border dark:border-white/10`}>
                        <span className={`material-icons-round ${isMedia ? 'text-cyan-600 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'} text-sm`}>
                            {isMedia ? 'attach_file' : 'chat'}
                        </span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">
                        {isMedia ? 'Arquivo / Mídia' : 'Mensagem'}
                    </span>
                </div>

                {/* Body Clean */}
                <div className="p-4 relative">
                    {isMedia ? (
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                <span className="material-icons-round text-slate-500 text-lg">
                                    {data.mediaType === 'image' ? 'image' :
                                        data.mediaType === 'video' ? 'movie' :
                                            data.mediaType === 'audio' ? 'mic' : 'description'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{data.caption || (data.mediaType ? data.mediaType.toUpperCase() : 'MÍDIA')}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{data.url || 'URL vazia'}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                {data.message || 'Olá! Como posso ajudar?'}
                            </p>
                            <span className="absolute top-4 right-4 text-slate-200 dark:text-white/5 material-icons-round text-3xl select-none -z-0">format_quote</span>
                        </>
                    )}
                </div>

                {/* Handles Invisíveis até Hover ou Seleção */}
                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-blue-500 !border-2 !border-white dark:!border-black transition-all" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-black shadow-sm transition-all" />
            </div>
        </div>
    );
};

export default memo(MessageNode);
