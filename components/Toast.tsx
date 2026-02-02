import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3500 }) => {
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        // Inicia a animação de saída um pouco antes de remover o componente
        const exitTimer = setTimeout(() => {
            setIsLeaving(true);
        }, duration - 600);

        const closeTimer = setTimeout(() => {
            onClose();
        }, duration);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(closeTimer);
        };
    }, [onClose, duration]);

    const icons: Record<ToastType, string> = {
        success: 'check_circle',
        error: 'cancel',
        warning: 'error',
        info: 'info'
    };

    const colors: Record<ToastType, string> = {
        success: 'bg-emerald-500',
        error: 'bg-rose-500',
        warning: 'bg-amber-500',
        info: 'bg-indigo-500'
    };

    return (
        <div className="fixed top-8 left-0 right-0 z-[1000000] flex justify-center px-6 pointer-events-none">
            <div className={`
                pointer-events-auto
                relative flex items-center gap-4 px-5 py-3.5 rounded-full 
                ${colors[type]} shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]
                border border-white/20 text-white
                ${isLeaving ? 'animate-toast-out' : 'animate-toast-in'}
                max-w-md
            `}>
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-xl">{icons[type]}</span>
                </div>

                <span className="text-sm font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {message}
                </span>

                <button
                    onClick={() => setIsLeaving(true)}
                    className="ml-2 w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-all opacity-60 hover:opacity-100"
                >
                    <span className="material-icons-round text-lg">close</span>
                </button>

                {/* Micro Progress Bar at the Bottom */}
                <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white/40 animate-progress-shrink"
                        style={{ animationDuration: `${duration}ms` }}
                    />
                </div>
            </div>

            <style>{`
                @keyframes toast-in {
                    0% { transform: translateY(-200%) scale(0.7); opacity: 0; filter: blur(8px); }
                    60% { transform: translateY(10%) scale(1.03); opacity: 1; filter: blur(0); }
                    100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
                }
                @keyframes toast-out {
                    0% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
                    100% { transform: translateY(-200%) scale(0.7); opacity: 0; filter: blur(8px); }
                }
                @keyframes progress-shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .animate-toast-in {
                    animation: toast-in 0.7s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                .animate-toast-out {
                    animation: toast-out 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                .animate-progress-shrink {
                    animation-name: progress-shrink;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
};

export default Toast;
