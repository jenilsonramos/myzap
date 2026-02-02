import React, { memo } from 'react';

const NoteNode = ({ data, selected }: any) => {
    const bgColor = data.color || '#fef3c7'; // Standard Post-it Yellow default
    // Determine text color based on background logic
    const isDarkBg = ['#1e293b', '#0f172a', '#000'].includes(bgColor);
    const textColor = isDarkBg ? 'text-white' : 'text-slate-800';
    const metaColor = isDarkBg ? 'text-slate-400' : 'text-slate-500/60';

    return (
        <div
            className={`shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] dark:shadow-none rounded-br-3xl rounded-tl-sm rounded-tr-lg rounded-bl-lg p-5 w-72 transition-all transform hover:scale-[1.02] hover:-rotate-1 cursor-grab active:cursor-grabbing ${selected ? 'ring-2 ring-indigo-500 rotate-0 z-50' : 'rotate-1'}`}
            style={{ backgroundColor: bgColor }}
        >
            {/* Visual 'Tape' effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/30 backdrop-blur-sm rotate-2 shadow-sm rounded-sm z-10"></div>

            <div className="flex items-center gap-2 mb-3 opacity-90">
                <div className={`p-1.5 rounded-md bg-black/5 ${textColor}`}>
                    <span className="material-icons-round text-sm block">edit_note</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${metaColor}`}>Nota</span>
            </div>

            <div className={`text-sm ${textColor} whitespace-pre-wrap leading-relaxed font-secondary font-medium`}>
                {data.text || 'Digite sua nota...'}
            </div>

            {/* Folded Corner Effect Visual */}
            <div
                className="absolute bottom-0 right-0 w-8 h-8 rounded-tl-xl z-20"
                style={{
                    background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)',
                }}
            ></div>
        </div>
    );
};

export default memo(NoteNode);
