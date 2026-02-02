
import React, { useState } from 'react';

const CampaignsView: React.FC = () => {
    const [campaigns, setCampaigns] = useState<any[]>([]); // Preparado para o banco
    const [loading, setLoading] = useState<boolean>(false);


    return (
        <div className="flex flex-col gap-8 animate-fadeIn h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Campanhas de Transmissão</h2>
                    <p className="text-slate-500 font-medium">Crie e monitore disparos em massa para seus contatos.</p>
                </div>
                <button className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                    <span className="material-icons-round">add_to_photos</span>
                    <span>Nova Campanha</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-indigo-500 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                    <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl opacity-20 group-hover:scale-110 transition-transform">campaign</span>
                    <p className="text-indigo-100 font-bold text-xs uppercase tracking-widest mb-1">Total Enviado</p>
                    <h3 className="text-3xl font-black">0</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-100 bg-white/10 w-fit px-2 py-1 rounded-lg">
                        <span className="material-icons-round text-sm">trending_up</span>
                        <span>+12% este mês</span>
                    </div>
                </div>
                <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
                    <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl opacity-20 group-hover:scale-110 transition-transform">verified</span>
                    <p className="text-emerald-100 font-bold text-xs uppercase tracking-widest mb-1">Taxa de Sucesso</p>
                    <h3 className="text-3xl font-black">0%</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-100 bg-white/10 w-fit px-2 py-1 rounded-lg">
                        <span className="material-icons-round text-sm">check_circle</span>
                        <span>Alta eficácia</span>
                    </div>
                </div>
                <div className="bg-amber-500 rounded-3xl p-6 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden group">
                    <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl opacity-20 group-hover:scale-110 transition-transform">schedule</span>
                    <p className="text-amber-100 font-bold text-xs uppercase tracking-widest mb-1">Agendadas</p>
                    <h3 className="text-3xl font-black">0</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-amber-100 bg-white/10 w-fit px-2 py-1 rounded-lg">
                        <span className="material-icons-round text-sm">event</span>
                        <span>Próximo disparo: Amanhã</span>
                    </div>
                </div>
                <div className="bg-rose-500 rounded-3xl p-6 text-white shadow-xl shadow-rose-500/20 relative overflow-hidden group">
                    <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl opacity-20 group-hover:scale-110 transition-transform">error_outline</span>
                    <p className="text-rose-100 font-bold text-xs uppercase tracking-widest mb-1">Erros</p>
                    <h3 className="text-3xl font-black">0%</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-rose-100 bg-white/10 w-fit px-2 py-1 rounded-lg">
                        <span className="material-icons-round text-sm">trending_down</span>
                        <span>-2% que ontem</span>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-huge shadow-2xl border border-white/20 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-card-dark/50 backdrop-blur-md">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">Suas Campanhas</h3>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Todas</button>
                        <button className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-primary transition-colors">Ativas</button>
                        <button className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-primary transition-colors">Concluídas</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Campanha</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enviados</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucesso</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {campaigns.map((camp) => (
                                <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5">
                                        <span className="font-bold text-slate-800 dark:text-slate-100">{camp.name}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${camp.status === 'Ativa' ? 'bg-emerald-100 text-emerald-600' :
                                            camp.status === 'Agendada' ? 'bg-amber-100 text-amber-600' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {camp.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-medium text-slate-600 dark:text-slate-400">{camp.sent}</td>
                                    <td className="px-6 py-5 font-medium text-slate-600 dark:text-slate-400">{camp.pending}</td>
                                    <td className="px-6 py-5 font-bold text-emerald-500">{camp.successRate}</td>
                                    <td className="px-6 py-5 font-medium text-slate-500">{camp.date}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex gap-2">
                                            <button className="material-icons-round text-slate-400 hover:text-primary transition-colors text-xl">bar_chart</button>
                                            <button className="material-icons-round text-slate-400 hover:text-emerald-500 transition-colors text-xl">play_arrow</button>
                                            <button className="material-icons-round text-slate-400 hover:text-rose-500 transition-colors text-xl">delete_outline</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CampaignsView;
