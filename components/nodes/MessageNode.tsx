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
                        <div className="flex flex-col gap-3">
                            <div className="aspect-video w-full bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200/50 dark:border-white/5 relative group/preview">
                                {data.url ? (
                                    data.mediaType === 'image' ? (
                                        <img src={data.url} className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110" alt="Preview" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/10 flex items-center justify-center shadow-sm">
                                                <span className="material-icons-round text-cyan-500 text-3xl">
                                                    {data.mediaType === 'video' ? 'play_circle' :
                                                        data.mediaType === 'audio' ? 'mic' : 'description'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black text-cyan-500/50 uppercase tracking-widest">{data.mediaType}</span>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="material-icons-round text-slate-300 dark:text-slate-600 text-3xl">cloud_off</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem arquivo</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 px-1">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate pr-6 relative">
                                    {data.caption || (data.mediaType ? data.mediaType.toUpperCase() : 'MÍDIA')}
                                    <span className="material-icons-round absolute right-0 top-0 text-[14px] text-slate-400">info_outline</span>
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate font-mono bg-slate-50 dark:bg-black/20 py-1 px-2 rounded-md border border-slate-100 dark:border-white/5">
                                    {data.url || 'URL não configurada'}
                                </p>
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
