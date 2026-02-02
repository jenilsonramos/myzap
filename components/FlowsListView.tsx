import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import Modal from './Modal';

interface Flow {
    id: string;
    name: string;
    status: 'active' | 'paused';
    executions: number;
    performance: string;
    instances: string[];
    updatedAt: string;
}

interface FlowsListViewProps {
    onEditFlow: (id: string) => void;
}

const FlowsListView: React.FC<FlowsListViewProps> = ({ onEditFlow }) => {
    const { showToast } = useToast();
    const [flows, setFlows] = useState<Flow[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const savedFlows = localStorage.getItem('myzap_flows');
        if (savedFlows) {
            setFlows(JSON.parse(savedFlows));
        } else {
            setFlows([]);
        }
    }, []);

    const handleCreateFlow = () => {
        if (!newFlowName.trim()) {
            showToast('Dê um nome ao seu fluxo', 'error');
            return;
        }

        const newFlow: Flow = {
            id: Date.now().toString(),
            name: newFlowName,
            status: 'paused',
            executions: 0,
            performance: '0%',
            instances: [],
            updatedAt: new Date().toLocaleDateString('pt-BR'),
        };

        const updatedFlows = [newFlow, ...flows];
        setFlows(updatedFlows);
        localStorage.setItem('myzap_flows', JSON.stringify(updatedFlows));
        setIsCreateModalOpen(false);
        setNewFlowName('');
        showToast('Fluxo criado com sucesso!', 'success');
        onEditFlow(newFlow.id);
    };

    const handleDeleteFlow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedFlows = flows.filter(f => f.id !== id);
        setFlows(updatedFlows);
        localStorage.setItem('myzap_flows', JSON.stringify(updatedFlows));
        showToast('Fluxo excluído permanentemente', 'success');
    };

    const toggleStatus = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedFlows = flows.map(f => f.id === id ? { ...f, status: f.status === 'active' ? 'paused' : 'active' as any } : f);
        setFlows(updatedFlows);
        localStorage.setItem('myzap_flows', JSON.stringify(updatedFlows));
    };

    const stats = {
        total: flows.length,
        active: flows.filter(f => f.status === 'active').length,
        paused: flows.filter(f => f.status === 'paused').length,
    };

    const filteredFlows = flows.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header with Stats */}
            <div className="flex flex-col xl:flex-row gap-6 items-start justify-between">
                <div className="flex flex-wrap gap-4">
                    <div className="bg-white dark:bg-card-dark px-8 py-6 rounded-huge border border-slate-100 dark:border-white/5 shadow-xl min-w-[200px] group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                <span className="material-icons-round text-lg">account_tree</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Fluxos</p>
                        </div>
                        <h4 className="text-4xl font-black dark:text-white uppercase">{stats.total}</h4>
                    </div>
                    <div className="bg-white dark:bg-card-dark px-8 py-6 rounded-huge border border-slate-100 dark:border-white/5 shadow-xl min-w-[200px] group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <span className="material-icons-round text-lg">check_circle</span>
                            </div>
                            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Ativos</p>
                        </div>
                        <h4 className="text-4xl font-black text-emerald-500 uppercase">{stats.active}</h4>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Pesquisar fluxos..."
                            className="w-full bg-white dark:bg-card-dark pl-12 pr-4 py-4 rounded-2xl border border-slate-100 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full md:w-auto bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">add</span>
                        Criar Novo Fluxo
                    </button>
                </div>
            </div>

            {/* List View Container */}
            <div className="flex flex-col gap-3">
                {filteredFlows.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center opacity-30">
                        <span className="material-icons-round text-9xl">account_tree</span>
                        <p className="font-black uppercase tracking-widest mt-4">Nenhum fluxo encontrado</p>
                    </div>
                ) : filteredFlows.map((flow) => (
                    <div
                        key={flow.id}
                        onClick={() => onEditFlow(flow.id)}
                        className="group relative bg-white dark:bg-card-dark hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-6 transition-all cursor-pointer shadow-sm hover:shadow-lg"
                    >
                        {/* 1. Icon & Name info */}
                        <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                <span className="material-icons-round text-xl">bolt</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight md:truncate md:max-w-[200px] lg:max-w-xs">{flow.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                                    <span className="material-icons-round text-[10px]">update</span> {flow.updatedAt}
                                </p>
                            </div>
                        </div>

                        {/* 2. Stats (Executions & Rate) */}
                        <div className="flex items-center gap-8 w-full md:w-auto justify-start md:justify-center border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-3 md:pt-0">
                            <div className="flex flex-col items-start md:items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Disparos</span>
                                <span className="font-bold dark:text-white">{flow.executions.toLocaleString()}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-100 dark:bg-white/10 hidden md:block"></div>
                            <div className="flex flex-col items-start md:items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Taxa</span>
                                <span className="font-bold dark:text-white">{flow.performance}</span>
                            </div>
                        </div>

                        {/* 3. Instances Pill */}
                        <div className="flex items-center gap-1">
                            {flow.instances.length > 0 ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{flow.instances.length} Instância{flow.instances.length > 1 && 's'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-white/10 opacity-50">
                                    <span className="material-icons-round text-[12px]">link_off</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Sem Vínculo</span>
                                </div>
                            )}
                        </div>

                        {/* 4. Actions & Status */}
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-3 md:pt-0">
                            <button
                                onClick={(e) => toggleStatus(flow.id, e)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${flow.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                {flow.status === 'active' ? 'Ativo' : 'Pausado'}
                            </button>

                            <div className="w-px h-8 bg-slate-100 dark:bg-white/10 mx-1"></div>

                            <button
                                onClick={(e) => { e.stopPropagation(); onEditFlow(flow.id); }}
                                className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button
                                onClick={(e) => handleDeleteFlow(flow.id, e)}
                                className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Flow Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Criar Novo Fluxo"
                subtitle="Dê um nome épico para sua automação"
            >
                <div className="p-10 space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nome do Fluxo</label>
                        <input
                            type="text"
                            placeholder="Ex: Recuperação de Carrinho VIP"
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-6 py-5 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                            value={newFlowName}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFlow()}
                            onChange={(e) => setNewFlowName(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleCreateFlow}
                        className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                    >
                        Criar e Abrir Designer
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default FlowsListView;
