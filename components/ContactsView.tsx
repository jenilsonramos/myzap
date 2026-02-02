
import React, { useState } from 'react';


const ContactsView: React.FC = () => {
    const [contacts, setContacts] = useState<any[]>([]); // Preparado para o banco
    const [loading, setLoading] = useState<boolean>(false);


    return (
        <div className="flex flex-col gap-6 animate-fadeIn h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Agenda de Contatos</h2>
                    <p className="text-slate-500 font-medium">Gerencie seus clientes e grupos de forma organizada.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Pesquisar contatos..."
                            className="pl-10 pr-4 py-3 bg-white dark:bg-card-dark rounded-2xl shadow-lg border border-white/20 focus:ring-2 focus:ring-primary outline-none min-w-[280px] transition-all"
                        />
                    </div>
                    <button className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                        <span className="material-icons-round">person_add</span>
                        <span>Novo Contato</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-6">
                {contacts.map((contact) => (
                    <div key={contact.id} className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-xl border border-white/20 hover:border-primary/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />

                        <div className="flex items-start justify-between mb-6 relative">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <img src={contact.avatar} alt={contact.name} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-slate-800" />
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${contact.lastSeen === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{contact.name}</h3>
                                    <p className="text-sm text-slate-500 font-medium">{contact.phone}</p>
                                </div>
                            </div>
                            <button className="material-icons-round text-slate-400 hover:text-primary transition-colors">edit</button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6 relative">
                            {contact.groups.map((group, idx) => (
                                <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider">
                                    {group}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                            <div className="flex items-center gap-2">
                                <span className="material-icons-round text-slate-400 text-sm">history</span>
                                <span className="text-xs text-slate-500">{contact.lastSeen === 'Online' ? 'Visto agora' : `Última vez ${contact.lastSeen}`}</span>
                            </div>
                            <button className="flex items-center gap-1.5 text-primary text-xs font-bold hover:gap-2 transition-all group/btn">
                                <span>ENVIAR MENSAGEM</span>
                                <span className="material-icons-round text-sm">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactsView;
