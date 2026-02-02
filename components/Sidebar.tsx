
import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onToggleTheme, isDarkMode, onLogout }) => {

  return (
    <aside className="hidden md:flex w-24 lg:w-28 bg-primary rounded-huge flex-col items-center py-6 shrink-0 shadow-2xl border border-primary/20 relative z-30">
      {/* Sidebar Header: Logo */}
      <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-8 cursor-pointer hover:bg-white/30 transition-all shadow-inner shrink-0">
        <span className="material-icons-round text-white text-4xl">hub</span>
      </div>

      {/* Scrollable Navigation Body */}
      <nav className="flex-1 w-full flex flex-col items-center gap-6 overflow-y-auto custom-scrollbar px-2 py-4 no-scrollbar">
        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        <button
          onClick={() => onViewChange(AppView.ADMIN)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.ADMIN ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Admin"
        >
          <span className="material-icons-round text-3xl">admin_panel_settings</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.ANALYTICS)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.ANALYTICS ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Analytics"
        >
          <span className="material-icons-round text-3xl">analytics</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.INSTANCES)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.INSTANCES ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Instâncias"
        >
          <span className="material-icons-round text-3xl">grid_view</span>
        </button>


        <button
          onClick={() => onViewChange(AppView.CHAT)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.CHAT ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Chat"
        >
          <span className="material-icons-round text-3xl">chat</span>
        </button>
        |
        <button
          onClick={() => onViewChange(AppView.CONTACTS)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.CONTACTS ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Contatos"
        >
          <span className="material-icons-round text-3xl">groups</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.CAMPAIGNS)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.CAMPAIGNS ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Campanhas"
        >
          <span className="material-icons-round text-3xl">campaign</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.FLOWS_LIST)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.FLOWS_LIST || currentView === AppView.FLOWBUILDER ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Flowbuilder"
        >
          <span className="material-icons-round text-3xl">account_tree</span>
        </button>


        <button className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all shrink-0">
          <span className="material-icons-round text-3xl">auto_fix_high</span>
        </button>

        <button className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all shrink-0">
          <span className="material-icons-round text-3xl">history</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.AI_INTEGRATION)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.AI_INTEGRATION ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Integração IA"
        >
          <span className="material-icons-round text-3xl">psychology</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.MY_PLAN)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.MY_PLAN ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Meu Plano"
        >
          <span className="material-icons-round text-3xl">workspace_premium</span>
        </button>

        <button
          onClick={() => onViewChange(AppView.SETTINGS)}
          className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${currentView === AppView.SETTINGS ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title="Configurações"
        >
          <span className="material-icons-round text-3xl">settings</span>
        </button>

      </nav>

      {/* Sidebar Footer: Theme & User */}
      <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-white/10 shrink-0 w-full items-center">
        <button
          onClick={onToggleTheme}
          className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
        >
          <span className="material-icons-round text-3xl">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button
          onClick={onLogout}
          className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 rounded-2xl transition-all"
        >
          <span className="material-icons-round text-3xl">logout</span>
        </button>

      </div>
    </aside>
  );
};

export default Sidebar;
