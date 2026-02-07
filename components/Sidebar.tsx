
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView; // Mantido para compatibilidade temporária
  onViewChange: (view: any) => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onLogout: () => void;
  publicSettings?: any;
}

const Sidebar: React.FC<SidebarProps> = ({ onToggleTheme, isDarkMode, onLogout, publicSettings }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const userStr = localStorage.getItem('myzap_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { view: AppView.ADMIN, icon: 'admin_panel_settings', path: '/admin', title: 'Admin', adminOnly: true },
    { view: AppView.SERVER_HEALTH, icon: 'monitor_heart', path: '/server-health', title: 'Saúde do Servidor', adminOnly: true },
    { view: AppView.ANALYTICS, icon: 'analytics', path: '/analytics', title: 'Analytics' },
    { view: AppView.INSTANCES, icon: 'grid_view', path: '/instances', title: 'Instâncias' },
    { view: AppView.CHAT, icon: 'chat', path: '/chat', title: 'Chat' },
    { view: AppView.CONTACTS, icon: 'groups', path: '/contacts', title: 'Contatos' },
    { view: AppView.CAMPAIGNS, icon: 'campaign', path: '/campaigns', title: 'Campanhas' },
    { view: AppView.FLOWS_LIST, icon: 'account_tree', path: '/flows', title: 'Flowbuilder' },
    { view: AppView.CHATBOT, icon: 'smart_toy', path: '/chatbot', title: 'Chatbot' },
    { view: AppView.AI_INTEGRATION, icon: 'psychology', path: '/ai-integration', title: 'Integração IA' },
    { view: AppView.MY_PLAN, icon: 'workspace_premium', path: '/my-plan', title: 'Meu Plano' },
    { view: AppView.SETTINGS, icon: 'settings', path: '/settings', title: 'Configurações' },
    { view: AppView.API_DOCS, icon: 'integration_instructions', path: '/api-docs', title: 'Api Developer' },
  ].filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden md:flex w-24 lg:w-28 bg-primary rounded-huge flex-col items-center py-6 shrink-0 shadow-2xl border border-primary/20 relative z-30">
      {/* Sidebar Header: Logo */}
      <div
        onClick={() => navigate('/')}
        className="w-14 h-14 lg:w-16 lg:h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-8 cursor-pointer hover:bg-white/30 transition-all shadow-inner shrink-0 overflow-hidden"
        title={publicSettings?.system_name || 'MyZap'}
      >
        {publicSettings?.logo_url ? (
          <img src={publicSettings.logo_url} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <span className="material-icons-round text-white text-4xl">hub</span>
        )}
      </div>

      {/* Scrollable Navigation Body */}
      <nav className="flex-1 w-full flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar px-2 py-4 no-scrollbar">
        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl transition-all shrink-0 ${isActive(item.path) || (item.path === '/flows' && location.pathname.startsWith('/flows')) ? 'bg-white/20 text-white shadow-lg scale-105' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title={item.title}
          >
            <span className="material-icons-round text-3xl">{item.icon}</span>
          </button>
        ))}
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
        <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest mb-2">v2.0.3</span>
      </div>
    </aside>
  );
};

export default Sidebar;
