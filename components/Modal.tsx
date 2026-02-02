import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'info' | 'success' | 'warning';
    showInput?: boolean;
    inputValue?: string;
    onInputChange?: (value: string) => void;
    inputPlaceholder?: string;
    children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    type = 'info',
    showInput = false,
    inputValue = '',
    onInputChange,
    inputPlaceholder = 'Digite aqui...',
    children
}) => {
    if (!isOpen) return null;

    const icons = {
        danger: 'report_problem',
        info: 'info',
        success: 'check_circle',
        warning: 'warning'
    };

    const colors = {
        danger: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
        info: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
        success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-huge shadow-2xl border border-white/10 dark:border-white/5 relative z-10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="p-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${colors[type as keyof typeof colors]}`}>
                        <span className="material-icons-round text-3xl">
                            {icons[type as keyof typeof icons]}
                        </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 leading-tight uppercase tracking-tight">
                        {title}
                    </h3>

                    {message && (
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
                            {message}
                        </p>
                    )}

                    {showInput && (
                        <div className="mt-6">
                            <input
                                type="text"
                                autoFocus
                                value={inputValue}
                                onChange={(e) => onInputChange?.(e.target.value)}
                                placeholder={inputPlaceholder}
                                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:border-primary transition-all outline-none dark:text-white"
                                onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                            />
                        </div>
                    )}

                    {children && (
                        <div className="mt-6">
                            {children}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 border border-transparent dark:border-white/5"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-[2] px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-rose-600 shadow-rose-600/30 hover:bg-rose-700' : 'bg-primary shadow-emerald-500/30 hover:bg-emerald-600'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
