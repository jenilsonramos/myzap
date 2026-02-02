
import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
}

const Header: React.FC<HeaderProps> = ({ currentView }) => {
  const titles: Record<string, { title: string; subtitle: string }> = {
    [AppView.INSTANCES]: { title: 'Instâncias', subtitle: 'Gerencie suas conexões Evolution API' },
    [AppView.ANALYTICS]: { title: 'Análise Geral', subtitle: 'Métricas de tráfego e atendimento' },
    [AppView.CHAT]: { title: 'Live Chat', subtitle: 'Atendimento omnicanal em tempo real' },
    [AppView.CONTACTS]: { title: 'Contatos', subtitle: 'Sua lista de clientes e leads' },
    [AppView.CAMPAIGNS]: { title: 'Campanhas', subtitle: 'Gestão de disparos e automações' },
    [AppView.SETTINGS]: { title: 'Configurações', subtitle: 'Preferências do sistema MyZap' },
    [AppView.FLOWS_LIST]: { title: 'Flowbuilder', subtitle: 'Gestão de fluxos de automação' },
    [AppView.FLOWBUILDER]: { title: 'Flow Designer', subtitle: 'Desenhando a jornada do cliente' },
    [AppView.MY_PLAN]: { title: 'Meu Plano', subtitle: 'Gestão de assinatura e limites' },
    [AppView.AI_INTEGRATION]: { title: 'Inteligência Artificial', subtitle: 'Configure modelos Gemini e GPT para seus fluxos' },
    [AppView.ADMIN]: { title: 'Painel Administrativo', subtitle: 'Gestão global do sistema e assinaturas' },
  };

  const { title, subtitle } = titles[currentView] || titles[AppView.ANALYTICS];

  return (
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
      <div className="animate-in fade-in slide-in-from-left duration-700">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {title}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium mt-1">
          {subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:gap-5">
        <div className="relative group flex-1 min-w-[200px] md:flex-none">
          <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="pl-11 pr-4 py-3 rounded-2xl border-none bg-white dark:bg-card-dark shadow-sm focus:ring-2 focus:ring-primary w-full md:w-72 text-sm transition-all outline-none"
            placeholder="Pesquisar instâncias..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="p-3 bg-white dark:bg-card-dark rounded-2xl shadow-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-all active:scale-95 border border-transparent dark:border-slate-800">
            <span className="material-icons-round text-2xl">notifications_active</span>
          </button>

          <div className="h-12 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block mx-1"></div>

          <div className="flex items-center gap-3 pl-1 pr-1 py-1 rounded-2xl bg-white dark:bg-card-dark shadow-sm border border-transparent dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-inner border border-slate-100 dark:border-slate-700 shrink-0">
              <img
                alt="Avatar"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
              />
            </div>
            <div className="hidden sm:block pr-3 leading-tight">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Admin Evolution</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Project Owner</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
