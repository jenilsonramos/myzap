import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const MediaNode = ({ data, selected }: any) => {
    return (
        <div className={`w-64 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-cyan-400 to-sky-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all overflow-hidden ${selected ? 'border-cyan-400/50 shadow-[0_8px_30px_-6px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/20' : 'border-slate-200 dark:border-white/5 hover:border-cyan-300/30'}`}>

                <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center shrink-0 border border-cyan-200/50 dark:border-cyan-500/10">
                        <span className="material-icons-round text-cyan-600 dark:text-cyan-400 text-sm">image</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Mídia</span>
                </div>

                <div className="p-3">
                    <div className="aspect-video bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200/50 dark:border-white/5 relative group/media">
                        {data.url ? (
                            data.mediaType === 'image' ? <img src={data.url} className="w-full h-full object-cover" /> :
                                <span className="material-icons-round text-cyan-500 text-3xl">play_circle</span>
                        ) : (
                            <span className="material-icons-round text-slate-300 dark:text-slate-600 text-2xl">broken_image</span>
                        )}
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-cyan-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white dark:!border-black" />
            </div>
        </div>
    );
};

export default memo(MediaNode);
