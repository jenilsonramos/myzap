
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import InstanceView from './components/InstanceView';
import AnalyticsView from './components/AnalyticsView';
import ChatView from './components/ChatView';
import ContactsView from './components/ContactsView';
import CampaignsView from './components/CampaignsView';
import SettingsView from './components/SettingsView';
import AIIntegrationView from './components/AIIntegrationView';
import AdminView from './components/AdminView';
import FlowbuilderView from './components/FlowbuilderView';
import FlowsListView from './components/FlowsListView';
import Modal from './components/Modal';
import SubscriptionView from './components/SubscriptionView';
import { AppView } from './types';
import { ToastProvider } from './components/ToastContext';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.ANALYTICS);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = useCallback(() => {
    setIsLogoutModalOpen(true);
  }, []);

  const confirmLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
    // Simulação de logout
    console.log('Sessão encerrada com sucesso');
    // Futuramente adicionar lógica de limpeza de localstorage/cookies e redirecionamento
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {

    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const newVal = !prev;
      if (newVal) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      return newVal;
    });
  }, []);

  const renderView = () => {
    switch (currentView) {
      case AppView.ADMIN:
        return <AdminView />;
      case AppView.INSTANCES: return <InstanceView />;
      case AppView.ANALYTICS: return <AnalyticsView />;
      case AppView.CHAT: return <ChatView />;
      case AppView.CONTACTS: return <ContactsView />;
      case AppView.CAMPAIGNS: return <CampaignsView />;
      case AppView.SETTINGS:
        return <SettingsView />;
      case AppView.MY_PLAN:
        return <SubscriptionView />;
      case AppView.AI_INTEGRATION:
        return <AIIntegrationView />;
      case AppView.FLOWS_LIST: return (
        <FlowsListView
          onEditFlow={(id) => {
            setSelectedFlowId(id);
            setCurrentView(AppView.FLOWBUILDER);
          }}
        />
      );
      case AppView.FLOWBUILDER: return (
        <FlowbuilderView
          flowId={selectedFlowId}
          onClose={() => setCurrentView(AppView.FLOWS_LIST)}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />
      );
      default: return <InstanceView />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark p-2 md:p-4 lg:p-6 gap-4 lg:gap-6">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onToggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
          onLogout={handleLogout}
        />


        <main className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
          <Header currentView={currentView} />

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
            {renderView()}
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-slate-100 dark:border-white/5 px-6 py-4 flex items-center justify-between z-50">
          <button
            onClick={() => setCurrentView(AppView.ADMIN)}
            className={`material-icons-round transition-colors ${currentView === AppView.ADMIN ? 'text-primary' : 'text-slate-400'}`}
          >
            admin_panel_settings
          </button>
          <button
            onClick={() => setCurrentView(AppView.ANALYTICS)}
            className={`material-icons-round transition-colors ${currentView === AppView.ANALYTICS ? 'text-primary' : 'text-slate-400'}`}
          >
            analytics
          </button>
          <button
            onClick={() => setCurrentView(AppView.INSTANCES)}
            className={`material-icons-round transition-colors ${currentView === AppView.INSTANCES ? 'text-primary' : 'text-slate-400'}`}
          >
            grid_view
          </button>
          <button
            onClick={() => setCurrentView(AppView.CHAT)}
            className={`material-icons-round transition-colors ${currentView === AppView.CHAT ? 'text-primary' : 'text-slate-400'}`}
          >
            chat
          </button>
          <button
            onClick={() => setCurrentView(AppView.CONTACTS)}
            className={`material-icons-round transition-colors ${currentView === AppView.CONTACTS ? 'text-primary' : 'text-slate-400'}`}
          >
            groups
          </button>
          <button
            onClick={() => setCurrentView(AppView.FLOWS_LIST)}
            className={`material-icons-round transition-colors ${currentView === AppView.FLOWS_LIST || currentView === AppView.FLOWBUILDER ? 'text-primary' : 'text-slate-400'}`}
          >
            account_tree
          </button>
          <button
            onClick={() => setCurrentView(AppView.AI_INTEGRATION)}
            className={`material-icons-round transition-colors ${currentView === AppView.AI_INTEGRATION ? 'text-primary' : 'text-slate-400'}`}
          >
            psychology
          </button>
          <button
            onClick={() => setCurrentView(AppView.MY_PLAN)}
            className={`material-icons-round transition-colors ${currentView === AppView.MY_PLAN ? 'text-primary' : 'text-slate-400'}`}
          >
            workspace_premium
          </button>
          <button
            onClick={() => setCurrentView(AppView.SETTINGS)}
            className={`material-icons-round transition-colors ${currentView === AppView.SETTINGS ? 'text-primary' : 'text-slate-400'}`}
          >
            settings
          </button>

        </div>

        <Modal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirm={confirmLogout}
          title="Deseja sair?"
          message="Você será desconectado do painel administrativo do MyZap. Tem certeza que deseja encerrar sua sessão agora?"
          confirmLabel="Sair agora"
          cancelLabel="Ficar no Painel"
          type="danger"
        />
      </div>
    </ToastProvider>
  );
};


export default App;
