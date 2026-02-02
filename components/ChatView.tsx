
import React, { useState } from 'react';

const ChatView: React.FC = () => {
    const [selectedContact, setSelectedContact] = useState<string | null>(null);
    const [contacts, setContacts] = useState<any[]>([]); // Preparado para o banco
    const [loading, setLoading] = useState<boolean>(false);

    return (

        <div className="flex h-full gap-6 overflow-hidden">
            {/* Contact List */}
            <div className="w-80 flex flex-col gap-4 shrink-0">
                <div className="bg-white dark:bg-card-dark rounded-3xl p-4 shadow-xl border border-white/20">
                    <div className="relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar conversas..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-card-dark rounded-3xl shadow-xl border border-white/20 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Conversas</h3>
                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-lg">12 Ativas</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => setSelectedContact(contact.id)}
                                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all mb-1 ${selectedContact === contact.id ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                <div className="relative">
                                    <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-xl object-cover shadow-md" />
                                    {contact.online && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className={`font-bold truncate ${selectedContact === contact.id ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{contact.name}</h4>
                                        <span className={`text-[10px] ${selectedContact === contact.id ? 'text-white/70' : 'text-slate-400'}`}>{contact.time}</span>
                                    </div>
                                    <p className={`text-xs truncate ${selectedContact === contact.id ? 'text-white/80' : 'text-slate-500'}`}>{contact.lastMessage}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white dark:bg-card-dark rounded-huge shadow-2xl border border-white/20 overflow-hidden relative">
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <span className="material-icons-round text-primary text-5xl">forum</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Selecione uma conversa</h2>
                        <p className="text-slate-500 max-w-xs">Escolha um contato ao lado para iniciar ou continuar o seu atendimento.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-card-dark/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <img src={contacts.find(c => c.id === selectedContact)?.avatar} className="w-10 h-10 rounded-xl" />
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{contacts.find(c => c.id === selectedContact)?.name}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Online agora</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-500">
                                    <span className="material-icons-round">videocam</span>
                                </button>
                                <button className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-500">
                                    <span className="material-icons-round">call</span>
                                </button>
                                <button className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-500">
                                    <span className="material-icons-round">more_vert</span>
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-4">
                            <div className="self-end max-w-[70%] bg-primary text-white p-4 rounded-2xl rounded-tr-none shadow-lg">
                                <p className="text-sm">Olá João! Como posso te ajudar hoje?</p>
                                <span className="text-[10px] text-white/70 mt-1 block text-right">10:30 • Lido</span>
                            </div>
                            <div className="self-start max-w-[70%] bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-md border border-slate-100 dark:border-slate-700">
                                <p className="text-sm text-slate-800 dark:text-slate-100">Olá! Estou com uma dúvida sobre o prazo de entrega do meu último pedido #1234.</p>
                                <span className="text-[10px] text-slate-400 mt-1 block">10:31</span>
                            </div>
                            <div className="self-end max-w-[70%] bg-primary text-white p-4 rounded-2xl rounded-tr-none shadow-lg">
                                <p className="text-sm">Vou verificar agora mesmo para você. Só um momento...</p>
                                <span className="text-[10px] text-white/70 mt-1 block text-right">10:32 • Lido</span>
                            </div>
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-card-dark/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all flex items-center justify-center">
                                    <span className="material-icons-round">add</span>
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Escreva sua mensagem..."
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                    />
                                    <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                                        <span className="material-icons-round text-sm">send</span>
                                    </button>
                                </div>
                                <button className="material-icons-round text-slate-400 hover:text-primary transition-colors">sentiment_satisfied_alt</button>
                                <button className="material-icons-round text-slate-400 hover:text-primary transition-colors">mic</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatView;
