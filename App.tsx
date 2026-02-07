
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
import ChatbotView from './components/ChatbotView';
import ServerHealthView from './components/ServerHealthView';
import ApiDocsView from './components/ApiDocsView';
import { AppView } from './types';
import LandingView from './components/LandingView';
import { ToastProvider } from './components/ToastContext';

import { useToast } from './components/ToastContext';

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle payment status from URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      showToast('Assinatura processada com sucesso! Bem-vindo.', 'success');
      // Limpa os parâmetros da URL sem recarregar a página
      navigate(location.pathname, { replace: true });
    } else if (params.get('payment') === 'cancel') {
      showToast('O pagamento foi cancelado.', 'warning');
      navigate(location.pathname, { replace: true });
    }
  }, [location, showToast, navigate]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('myzap_auth') === 'true';
  });

  // --- LÓGICA DE NOTIFICAÇÃO GLOBAL ---
  const previousUnreadRef = React.useRef<number>(-1);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const playNotificationSound = React.useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audioRef.current.volume = 0.5;
    }
    audioRef.current.play().catch(() => { });
  }, []);

  const [status, setStatus] = useState<string>('active');
  const [publicSettings, setPublicSettings] = useState({
    system_name: 'MyZap',
    primary_color: '#166534',
    logo_url: '',
    favicon_url: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: ''
  });

  // --- BUSCA DE CONFIGURAÇÕES PÚBLICAS (BRANDING & SEO) ---
  React.useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          setPublicSettings(data);

          // Aplicar Título e SEO
          if (data.seo_title) document.title = data.seo_title;
          else if (data.system_name) document.title = data.system_name;

          // Atualizar Meta Description
          if (data.seo_description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
              metaDesc = document.createElement('meta');
              metaDesc.setAttribute('name', 'description');
              document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', data.seo_description);
          }

          // Aplicar Favicon
          if (data.favicon_url) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = data.favicon_url;
          }

          // Injetar Cor Primária no CSS
          if (data.primary_color) {
            document.documentElement.style.setProperty('--primary-color', data.primary_color);
            // Se o Tailwind estiver usando a variável, ele atualizará automaticamente
          }
        }
      } catch (err) {
        console.error('Erro ao buscar configurações públicas:', err);
      }
    };
    fetchPublicSettings();
  }, []);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const confirmLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
    localStorage.clear(); // Limpa TUDO para garantir privacidade total
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('myzap_theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('myzap_theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('myzap_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated || location.pathname === '/') return;

    const checkUserStatus = async () => {
      try {
        const token = localStorage.getItem('myzap_token');
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          localStorage.setItem('myzap_user', JSON.stringify(data));

          // Se estiver inativo/suspenso/expirado e não estiver na página de plano, redireciona
          const isUserAdmin = data.role === 'admin';
          const onPlanPage = location.pathname === '/my-plan';
          const isBlocked = ['inactive', 'suspended', 'expired'].includes(data.status);

          if (isBlocked && !isUserAdmin && !onPlanPage) {
            navigate('/my-plan');
            const blockerMsg = data.status === 'suspended'
              ? 'Sua conta foi suspensa pela administração.'
              : 'Sua assinatura expirou. Acesse "Meu Plano" para renovar.';
            showToast(blockerMsg, 'warning');
          }
        } else if (res.status === 401 || res.status === 403) {
          // Token expirado ou inválido
          confirmLogout();
        }
      } catch (err) {
        console.error('Erro ao validar status do usuário:', err);
      }
    };

    checkUserStatus();
    const statusInterval = setInterval(checkUserStatus, 60000); // Checa a cada minuto
    return () => clearInterval(statusInterval);
  }, [isAuthenticated, location.pathname, navigate, showToast, confirmLogout]);

  React.useEffect(() => {
    const isBlocked = ['inactive', 'suspended', 'expired'].includes(status || '');
    if (!isAuthenticated || isBlocked || location.pathname === '/') return;

    const checkUnread = async () => {
      try {
        const token = localStorage.getItem('myzap_token');
        const res = await fetch('/api/contacts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const totalUnread = data.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);

          if (previousUnreadRef.current !== -1 && totalUnread > previousUnreadRef.current) {
            playNotificationSound();
          }
          previousUnreadRef.current = totalUnread;
        }
      } catch (err) {
        console.error('Erro ao verificar notificações:', err);
      }
    };

    const interval = setInterval(checkUnread, 10000);
    checkUnread(); // Primeira execução
    return () => clearInterval(interval);
  }, [isAuthenticated, playNotificationSound, status]);


  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

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
    if (path === 'CHATBOT') return AppView.CHATBOT;
    if (path === 'SERVER-HEALTH') return AppView.SERVER_HEALTH;
    return AppView.ANALYTICS;
  };

  if (location.pathname === '/') {
    return <LandingView isAuthenticated={isAuthenticated} />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingView isAuthenticated={isAuthenticated} />} />
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
        <Route path="/reset-password" element={
          <AuthView
            initialView="reset-password"
            onLogin={handleLogin}
            onSignup={handleSignup}
            onRecover={(email) => console.log('Recover:', email)}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
          />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // --- MOBILE SIDEBAR STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark p-2 md:p-4 lg:p-6 gap-4 lg:gap-6">
      <Sidebar
        currentView={getCurrentView()}
        onViewChange={(view) => {
          const path = view.toLowerCase().replace('_', '-');
          navigate(`/${path}`);
          setIsSidebarOpen(false); // Close on navigation
        }}
        onToggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        onLogout={() => setIsLogoutModalOpen(true)}
        publicSettings={publicSettings}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
        {(status === 'inactive' || status === 'suspended' || status === 'expired') && !JSON.parse(localStorage.getItem('myzap_user') || '{}').role?.includes('admin') && (
          <div className="bg-rose-500 text-white px-6 py-3 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-500/20 animate-in slide-in-from-top duration-500 shrink-0 mx-4 mt-2 lg:mx-0 lg:mt-0">
            <div className="flex items-center gap-3">
              <span className="material-icons-round">report_problem</span>
              <p className="text-sm font-black uppercase lg:tracking-tighter">
                {status === 'suspended'
                  ? 'Sua conta foi suspensa pela administração. Entre em contato com o suporte.'
                  : 'Sua assinatura expirou ou o plano de testes acabou. Renove agora.'}
              </p>
            </div>
            <button onClick={() => navigate('/my-plan')} className="bg-white text-rose-500 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all ml-4 shrink-0">Ver Detalhes</button>
          </div>
        )}
        <Header
          currentView={getCurrentView()}
          systemName={publicSettings.system_name}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
          <Routes>
            <Route path="/branding" element={
              localStorage.getItem('myzap_user') && JSON.parse(localStorage.getItem('myzap_user') || '{}').role === 'admin'
                ? <Navigate to="/admin?tab=branding" replace />
                : <Navigate to="/analytics" replace />
            } />
            <Route path="/admin" element={
              localStorage.getItem('myzap_user') && JSON.parse(localStorage.getItem('myzap_user') || '{}').role === 'admin'
                ? <AdminView />
                : <Navigate to="/analytics" replace />
            } />
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
            <Route path="/chatbot" element={<ChatbotView />} />
            <Route path="/server-health" element={
              localStorage.getItem('myzap_user') && JSON.parse(localStorage.getItem('myzap_user') || '{}').role === 'admin'
                ? <ServerHealthView />
                : <Navigate to="/analytics" replace />
            } />
            <Route path="/api-docs" element={<ApiDocsView />} />
            <Route path="*" element={<Navigate to="/analytics" replace />} />
          </Routes>
        </div>
      </main>

      {/* Global Modals & Overlays */}
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
