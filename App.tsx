
import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import AuthView from './components/AuthView';
import { AppView } from './types';
import { ToastProvider } from './components/ToastContext';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('myzap_auth') === 'true';
  });

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogin = (data: any) => {
    console.log('Login Success:', data);
    setIsAuthenticated(true);
    navigate('/analytics');
  };

  const handleSignup = (data: any) => {
    console.log('Signup Action (Success via AuthView):', data);
    // O signup chama o alert e redireciona para login no AuthView,
    // então aqui apenas mantemos por compatibilidade de prop.
  };

  const confirmLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
    localStorage.removeItem('myzap_auth');
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

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

  const getCurrentView = () => {
    const path = location.pathname.substring(1).toUpperCase();
    if (path === 'CADASTRO') return AppView.SIGNUP;
    if (path === 'RECUPERAR') return AppView.RECOVER;
    if (path === 'ADMIN') return AppView.ADMIN;
    if (path === 'INSTANCES') return AppView.INSTANCES;
    if (path === 'CHAT') return AppView.CHAT;
    if (path === 'CONTACTS') return AppView.CONTACTS;
    if (path === 'CAMPAIGNS') return AppView.CAMPAIGNS;
    if (path === 'SETTINGS') return AppView.SETTINGS;
    if (path === 'FLOWS' || path === 'FLOWS/BUILDER') return AppView.FLOWS_LIST;
    if (path === 'MY-PLAN') return AppView.MY_PLAN;
    if (path === 'AI-INTEGRATION') return AppView.AI_INTEGRATION;
    return AppView.ANALYTICS;
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={
          <AuthView
            initialView="login"
            onLogin={handleLogin}
            onSignup={handleSignup}
            onRecover={(email) => console.log('Recover:', email)}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
          />
        } />
        <Route path="/cadastro" element={
          <AuthView
            initialView="signup"
            onLogin={handleLogin}
            onSignup={handleSignup}
            onRecover={(email) => console.log('Recover:', email)}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
          />
        } />
        <Route path="/recuperar" element={
          <AuthView
            initialView="recover"
            onLogin={handleLogin}
            onSignup={handleSignup}
            onRecover={(email) => console.log('Recover:', email)}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
          />
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark p-2 md:p-4 lg:p-6 gap-4 lg:gap-6">
      <Sidebar
        currentView={getCurrentView()}
        onViewChange={(view) => {
          const path = view.toLowerCase().replace('_', '-');
          navigate(`/${path}`);
        }}
        onToggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        onLogout={() => setIsLogoutModalOpen(true)}
      />

      <main className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
        <Header currentView={getCurrentView()} />

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
          <Routes>
            <Route path="/admin" element={<AdminView />} />
            <Route path="/instances" element={<InstanceView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/contacts" element={<ContactsView />} />
            <Route path="/campaigns" element={<CampaignsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/my-plan" element={<SubscriptionView />} />
            <Route path="/ai-integration" element={<AIIntegrationView />} />
            <Route path="/flows" element={
              <FlowsListView
                onEditFlow={(id) => {
                  setSelectedFlowId(id);
                  navigate('/flows/builder');
                }}
              />
            } />
            <Route path="/flows/builder" element={
              <FlowbuilderView
                flowId={selectedFlowId}
                onClose={() => navigate('/flows')}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
              />
            } />
            <Route path="/" element={<Navigate to="/analytics" replace />} />
            <Route path="*" element={<Navigate to="/analytics" replace />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Logout (Floating) */}
      <div className="md:hidden fixed bottom-16 left-4 right-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-100 dark:border-white/5 p-4 rounded-3xl flex items-center justify-center gap-4 z-40 shadow-2xl">
        <button onClick={() => setIsLogoutModalOpen(true)} className="flex items-center gap-2 text-rose-500 font-bold text-sm">
          <span className="material-icons-round">logout</span>
          Sair
        </button>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-slate-100 dark:border-white/5 px-6 py-4 flex items-center justify-between z-50">
        <button onClick={() => navigate('/admin')} className={`material-icons-round transition-colors ${location.pathname === '/admin' ? 'text-primary' : 'text-slate-400'}`}>admin_panel_settings</button>
        <button onClick={() => navigate('/analytics')} className={`material-icons-round transition-colors ${location.pathname === '/analytics' ? 'text-primary' : 'text-slate-400'}`}>analytics</button>
        <button onClick={() => navigate('/instances')} className={`material-icons-round transition-colors ${location.pathname === '/instances' ? 'text-primary' : 'text-slate-400'}`}>grid_view</button>
        <button onClick={() => navigate('/chat')} className={`material-icons-round transition-colors ${location.pathname === '/chat' ? 'text-primary' : 'text-slate-400'}`}>chat</button>
        <button onClick={() => navigate('/settings')} className={`material-icons-round transition-colors ${location.pathname === '/settings' ? 'text-primary' : 'text-slate-400'}`}>settings</button>
      </div>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="Deseja sair?"
        message="Você será desconectado do painel administrativo do MyZap."
        confirmLabel="Sair agora"
        cancelLabel="Cancelar"
        type="danger"
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
