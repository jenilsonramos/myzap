import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

interface Flow {
    id: string;
    name: string;
    status: 'active' | 'paused';
    executions?: number;
    performance?: string;
    instances?: string[];
    updated_at: string;
}

interface FlowsListViewProps {
    onEditFlow: (id: string) => void;
}

const FlowsListView: React.FC<FlowsListViewProps> = ({ onEditFlow }) => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { showToast } = useToast();

    const fetchFlows = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/flows', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFlows(data);
            } else {
                showToast('Erro ao carregar fluxos do servidor.', 'error');
            }
        } catch (err) {
            console.error('Network error fetching flows:', err);
            showToast('Falha na conexão com o servidor. Verifique se o backend está online.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFlows();
    }, []);

    const createNewFlow = async () => {
        const id = Math.random().toString(36).substr(2, 9);
        const name = `Novo Fluxo ${flows.length + 1}`;

        try {
            const response = await fetch('/api/flows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({ id, name })
            });

            if (response.ok) {
                showToast('Fluxo criado no banco!', 'success');
                fetchFlows();
                onEditFlow(id);
            } else {
                let errorMsg = 'Falha no banco';
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMsg = errorData.details || errorData.error || errorMsg;
                    } else {
                        errorMsg = `Erro ${response.status} no servidor`;
                    }
                } catch (e) {
                    errorMsg = 'Erro inesperado no servidor';
                }
                showToast(`Erro ao criar: ${errorMsg}`, 'error');
            }
        } catch (err) {
            console.error('Connection error creating flow:', err);
            showToast('Erro de conexão ao criar no banco.', 'error');
        }
    };

    const deleteFlow = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este fluxo?')) return;

        try {
            const response = await fetch(`/api/flows/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });

            if (response.ok) {
                showToast('Fluxo excluído!', 'success');
                fetchFlows();
            } else {
                showToast('Erro ao excluir do banco.', 'error');
            }
        } catch (err) {
            showToast('Erro de conexão.', 'error');
        }
    };

    const filteredFlows = flows.filter(f => (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading && flows.length === 0) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando com o banco...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tighter">Meus Fluxos</h2>
                    <p className="text-slate-500 text-sm font-medium">Gerencie suas automações no banco de dados</p>
                </div>
                <button
                    onClick={createNewFlow}
                    className="bg-indigo-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <span className="material-icons-round">add</span>
                    Criar Novo Fluxo
                </button>
            </div>

            {/* Search */}
            <div className="relative group">
                <span className="material-icons-round absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">search</span>
                <input
                    type="text"
                    placeholder="Pesquisar nos seus fluxos salvos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-card-dark border-none rounded-2xl md:rounded-huge px-12 md:px-14 py-4 md:py-5 text-sm md:text-base dark:text-white shadow-xl shadow-slate-200/50 dark:shadow-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                />
            </div>

            {/* Empty State */}
            {filteredFlows.length === 0 && (
                <div className="bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-huge p-10 md:p-20 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6">
                        <span className="material-icons-round text-3xl md:text-4xl text-slate-300">cloud_off</span>
                    </div>
                    <h3 className="text-lg md:text-xl font-black dark:text-white uppercase tracking-tight mb-2">Sem fluxos no banco</h3>
                    <p className="text-slate-500 text-sm font-medium mb-8 max-w-md mx-auto">Você ainda não tem fluxos salvos na sua conta ou a busca não retornou nada.</p>
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-indigo-600 font-black text-xs uppercase tracking-widest border-b-2 border-indigo-600 pb-1">Limpar busca</button>
                    )}
                </div>
            )}

            {/* Flows Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredFlows.map((flow) => (
                    <div
                        key={flow.id}
                        onClick={() => onEditFlow(flow.id)}
                        className="group relative bg-white dark:bg-card-dark rounded-huge p-6 md:p-8 border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden active:scale-[0.98]"
                    >
                        {/* Status Badge */}
                        <div className="flex justify-between items-start mb-6">
                            <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${flow.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                <span className="text-[10px] font-black uppercase tracking-widest">{flow.status === 'active' ? 'Ativo' : 'Pausado'}</span>
                            </div>
                            <button
                                onClick={(e) => deleteFlow(e, flow.id)}
                                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                                <span className="material-icons-round text-sm">delete</span>
                            </button>
                        </div>

                        {/* Flow Info */}
                        <h4 className="text-lg md:text-xl font-black dark:text-white mb-2 uppercase tracking-tight group-hover:text-indigo-500 transition-colors leading-tight line-clamp-2">{flow.name}</h4>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 px-1">
                            {flow.updated_at ? `Sincronizado: ${new Date(flow.updated_at).toLocaleDateString('pt-BR')}` : 'Novo'}
                        </p>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Execuções</p>
                                <p className="text-sm font-black dark:text-white">{flow.executions?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                <p className="text-sm font-black dark:text-white uppercase">{flow.status || 'Paused'}</p>
                            </div>
                        </div>

                        {/* Visual Decor */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-all"></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FlowsListView;
