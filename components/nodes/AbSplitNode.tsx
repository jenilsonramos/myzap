import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const AbSplitNode = ({ data, selected }: any) => {
    return (
        <div className={`w-56 group transition-all duration-300`}>
            <div className={`absolute -inset-[1px] bg-gradient-to-r from-purple-400 to-indigo-400 rounded-[22px] blur opacity-0 transition-opacity duration-300 ${selected ? 'opacity-40' : 'group-hover:opacity-10'}`}></div>

            <div className={`relative bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl rounded-[20px] shadow-sm border transition-all ${selected ? 'border-purple-400/50 shadow-[0_8px_30px_-6px_rgba(168,85,247,0.15)] ring-1 ring-purple-400/20' : 'border-slate-200 dark:border-white/5 hover:border-purple-300/30'}`}>

                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">Teste A/B</span>
                    <span className="material-icons-round text-purple-500 text-sm">alt_route</span>
                </div>

                <div className="p-3 flex items-center gap-2">
                    <div className="flex-1 text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <span className="block text-indigo-600 dark:text-indigo-400 font-bold">{data.variantA || 50}%</span>
                        <span className="text-[9px] uppercase text-indigo-400/80">A</span>
                    </div>
                    <div className="flex-1 text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <span className="block text-purple-600 dark:text-purple-400 font-bold">{data.variantB || 50}%</span>
                        <span className="text-[9px] uppercase text-purple-400/80">B</span>
                    </div>
                </div>

                <div className="hidden">
                    <Handle type="target" position={Position.Left} className="!bg-slate-400" />
                    <Handle type="source" position={Position.Right} id="a" className="!bg-indigo-500 !top-[40%]" />
                    <Handle type="source" position={Position.Right} id="b" className="!bg-purple-500 !top-[70%]" />
                </div>
                {/* Custom Handles to match visual pos */}
                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-300 hover:!bg-purple-500 !border-2 !border-white dark:!border-black" />
                <Handle type="source" position={Position.Right} id="a" className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-black !top-[55px]" />
                <Handle type="source" position={Position.Right} id="b" className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white dark:!border-black !top-[95px]" />
            </div>
        </div>
    );
};

export default memo(AbSplitNode);
