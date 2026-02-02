import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

interface Flow {
    id: string;
    name: string;
    status: 'active' | 'paused';
    updated_at: string;
}

interface FlowsListViewProps {
    onEditFlow: (id: string) => void;
}

const FlowsListView: React.FC<FlowsListViewProps> = ({ onEditFlow }) => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingFlow, setEditingFlow] = useState<{ id: string, name: string } | null>(null);
    const { showToast } = useToast();

    const fetchFlows = async () => {
        setIsLoading(false); // Manter false se já tiver dados para evitar flicker
        try {
            const response = await fetch('/api/flows', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) setFlows(await response.json());
        } catch (err) {
            showToast('Erro de conexão.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchFlows(); }, []);

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
                showToast('Fluxo criado!', 'success');
                fetchFlows();
                onEditFlow(id);
            }
        } catch (err) { showToast('Erro de conexão.', 'error'); }
    };

    const handleRename = async () => {
        if (!editingFlow) return;
        try {
            const response = await fetch(`/api/flows/${editingFlow.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({ name: editingFlow.name })
            });
            if (response.ok) {
                showToast('Renomeado!', 'success');
                setEditingFlow(null);
                fetchFlows();
            }
        } catch (err) { showToast('Erro de conexão.', 'error'); }
    };

    const deleteFlow = async (id: string) => {
        if (!confirm('Excluir este fluxo?')) return;
        try {
            const response = await fetch(`/api/flows/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
            });
            if (response.ok) { fetchFlows(); showToast('Excluído!', 'success'); }
        } catch (err) { showToast('Erro de conexão.', 'error'); }
    };

    const filteredFlows = flows.filter(f => (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tighter">Automações</h2>
                    <p className="text-slate-500 text-sm font-medium">Gerencie seus fluxos em lista</p>
                </div>
                <button
                    onClick={createNewFlow}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:scale-105 transition-all flex items-center gap-2"
                >
                    <span className="material-icons-round">add</span> Novo Fluxo
                </button>
            </div>

            <div className="relative group">
                <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-card-dark rounded-2xl px-12 py-4 text-sm dark:text-white shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                />
            </div>

            <div className="bg-white dark:bg-card-dark rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-white/5">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="px-6 py-4">Nome do Fluxo</th>
                            <th className="px-6 py-4 hidden md:table-cell">Status</th>
                            <th className="px-6 py-4 hidden sm:table-cell">Última Atualização</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {filteredFlows.map(flow => (
                            <tr key={flow.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                            <span className="material-icons-round text-sm">hub</span>
                                        </div>
                                        <button
                                            onClick={() => onEditFlow(flow.id)}
                                            className="text-sm font-bold text-slate-700 dark:text-white hover:text-indigo-500 transition-colors text-left"
                                        >
                                            {flow.name}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 hidden md:table-cell">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                        <div className={`w-1 h-1 rounded-full ${flow.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                        {flow.status === 'active' ? 'Ativo' : 'Pausado'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 hidden sm:table-cell">
                                    <span className="text-xs text-slate-500 font-medium">
                                        {flow.updated_at ? new Date(flow.updated_at).toLocaleDateString('pt-BR') : 'Recentemente'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setEditingFlow({ id: flow.id, name: flow.name })}
                                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-500 hover:text-white transition-all"
                                            title="Renomear"
                                        >
                                            <span className="material-icons-round text-sm">edit</span>
                                        </button>
                                        <button
                                            onClick={() => deleteFlow(flow.id)}
                                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-500 hover:text-white transition-all"
                                            title="Excluir"
                                        >
                                            <span className="material-icons-round text-sm">delete</span>
                                        </button>
                                        <button
                                            onClick={() => onEditFlow(flow.id)}
                                            className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                                            title="Abrir Editor"
                                        >
                                            <span className="material-icons-round text-sm">arrow_forward</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredFlows.length === 0 && (
                    <div className="p-12 text-center">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum fluxo encontrado</p>
                    </div>
                )}
            </div>

            {/* Modal de Renomeação Simples */}
            {editingFlow && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-white dark:border-white/5 animate-in zoom-in-95 duration-300">
                        <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter mb-6">Renomear Fluxo</h3>
                        <input
                            type="text"
                            value={editingFlow.name}
                            onChange={(e) => setEditingFlow({ ...editingFlow, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold mb-6"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditingFlow(null)}
                                className="flex-1 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRename}
                                className="flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlowsListView;
