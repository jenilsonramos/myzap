import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext';

interface AuthViewProps {
    onLogin: (data: any) => void;
    onSignup: (data: any) => void;
    onRecover: (email: string) => void;
    onToggleTheme: () => void;
    isDarkMode: boolean;
    initialView?: 'login' | 'signup' | 'recover' | 'activate' | 'reset-password';
}

const AuthView: React.FC<AuthViewProps> = ({
    onLogin,
    onSignup,
    onRecover,
    onToggleTheme,
    isDarkMode,
    initialView = 'login'
}) => {
    const navigate = useNavigate();
    const [view, setView] = useState<'login' | 'signup' | 'recover' | 'activate' | 'reset-password'>(initialView);
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);
    const [activationEmail, setActivationEmail] = useState('');
    const [activationCode, setActivationCode] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorStatus(null);

        const API_URL = '/api/auth';

        try {
            if (view === 'signup') {
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('As senhas não coincidem.');
                }
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        password: formData.password
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Erro no cadastro.');

                if (data.requireActivation) {
                    showToast('Conta criada! Verifique seu e-mail para ativar.', 'success');
                    setActivationEmail(data.email);
                    setView('activate');
                    return;
                }

                showToast('Cadastro realizado com sucesso!', 'success');
                const loginResponse = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email, password: formData.password })
                });
                const loginData = await loginResponse.json();
                if (loginResponse.ok) {
                    localStorage.setItem('myzap_token', loginData.token);
                    localStorage.setItem('myzap_user', JSON.stringify(loginData.user));
                    localStorage.setItem('myzap_auth', 'true');
                    onLogin(loginData);
                }
            } else if (view === 'login') {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email, password: formData.password })
                });
                const data = await response.json();
                if (!response.ok) {
                    if (data.status === 'pending_activation') {
                        setActivationEmail(formData.email);
                        setView('activate');
                        throw new Error('Sua conta aguarda ativação. Código enviado ao seu e-mail.');
                    }
                    throw new Error(data.error || 'Falha no login.');
                }
                localStorage.setItem('myzap_auth', 'true');
                localStorage.setItem('myzap_token', data.token);
                localStorage.setItem('myzap_user', JSON.stringify(data.user));
                showToast(`Bem-vindo de volta, ${data.user.name}!`, 'success');
                onLogin(data);
            } else if (view === 'activate') {
                const response = await fetch(`${API_URL}/activate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: activationEmail, code: activationCode })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Falha na ativação.');

                showToast('Conta ativada com sucesso!', 'success');

                // Login Automático após ativação
                if (data.token && data.user) {
                    localStorage.setItem('myzap_auth', 'true');
                    localStorage.setItem('myzap_token', data.token);
                    localStorage.setItem('myzap_user', JSON.stringify(data.user));
                    onLogin(data);
                } else {
                    setView('login');
                }
            } else if (view === 'recover') {
                const response = await fetch(`${API_URL}/recover`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Erro ao processar recuperação.');
                showToast('Link de recuperação enviado! Verifique seu e-mail.', 'success');
                setView('login');
            } else if (view === 'reset-password') {
                const searchParams = new URLSearchParams(window.location.search);
                const token = searchParams.get('token');

                if (!token) throw new Error('Token de redefinição não encontrado.');

                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword: formData.password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Erro ao redefinir senha.');

                showToast('Senha redefinida com sucesso!', 'success');
                setView('login');
            }
        } catch (err: any) {
            setErrorStatus(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const isLogin = view === 'login';

    const renderActivateForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-2xl md:text-3xl font-black text-[#10B981] mb-4 md:mb-6">Ativar Conta</h2>
            <div className="w-10 h-1 bg-[#10B981] mb-6 md:mb-8 rounded-full"></div>
            <p className="text-slate-400 text-center text-[10px] md:text-xs font-semibold mb-6 md:mb-8 uppercase tracking-widest px-4">
                Enviamos um código de 6 dígitos para <strong>{activationEmail}</strong>
            </p>

            <div className="w-full max-w-sm space-y-4">
                <input
                    type="text"
                    required
                    maxLength={6}
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO (EX: A1B2C3)"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-center text-xl font-black tracking-[0.5em] text-slate-900 outline-none transition-all placeholder:tracking-normal placeholder:font-bold placeholder:text-xs"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-10 md:px-12 py-3 md:py-4 rounded-full mt-8 md:mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs min-w-[160px]"
            >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Ativar Agora"}
            </button>

            <button type="button" onClick={() => setView('login')} className="text-slate-500 font-bold text-[10px] md:text-xs mt-6 uppercase tracking-widest hover:text-[#10B981] transition-all flex items-center gap-2">
                <span className="material-icons-round text-sm">west</span> Voltar para o Login
            </button>
        </div>
    );

    const renderLoginForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-2xl md:text-3xl font-black text-[#10B981] mb-4 md:mb-6">Acessar Conta</h2>
            <div className="w-10 h-1 bg-[#10B981] mb-6 md:mb-8 rounded-full"></div>

            <div className="flex gap-3 md:gap-4 mb-6 md:mb-8">
                {['f', 'G+', 'in'].map((icon) => (
                    <button key={icon} type="button" className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-800 font-bold hover:bg-slate-50 transition-all active:scale-90">
                        {icon === 'G+' ? <span className="text-xs md:text-sm font-black">G+</span> : <span className="material-icons-round text-lg md:text-xl">{icon === 'f' ? 'facebook' : icon}</span>}
                    </button>
                ))}
            </div>

            <p className="text-slate-400 text-[10px] md:text-xs font-semibold mb-6 md:mb-8 uppercase tracking-widest">ou use seu email</p>

            {errorStatus && (
                <div className="w-full bg-rose-500/10 text-rose-500 p-3 rounded-xl text-[9px] md:text-[10px] font-bold text-center mb-4 uppercase tracking-tighter">
                    {errorStatus}
                </div>
            )}

            <div className="w-full space-y-3 md:space-y-4 max-w-sm">
                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors text-lg md:text-xl">mail</span>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Email"
                        className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-6 text-sm text-slate-900 outline-none transition-all"
                    />
                </div>
                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors text-lg md:text-xl">lock</span>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Senha"
                        className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-6 text-sm text-slate-900 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="w-full max-w-sm flex items-center justify-between mt-4 md:mt-6 px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]" />
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-slate-600">Lembrar-me</span>
                </label>
                <button type="button" onClick={() => setView('recover')} className="text-slate-500 text-[10px] md:text-xs font-bold hover:text-[#10B981] underline transition-colors">Esqueceu a senha?</button>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-10 md:px-12 py-3 md:py-4 rounded-full mt-8 md:mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs min-w-[160px]"
            >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Entrar"}
            </button>
        </div>
    );

    const renderSignupForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-2xl md:text-3xl font-black text-[#10B981] mb-4 md:mb-6">Criar Conta</h2>
            <div className="w-10 h-1 bg-[#10B981] mb-6 md:mb-8 rounded-full"></div>
            <p className="text-slate-400 text-[10px] md:text-xs font-semibold mb-6 md:mb-8 uppercase tracking-widest text-center">Preencha seus dados para começar</p>

            <div className="w-full space-y-2 md:space-y-3 max-w-sm">
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome Completo"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="E-mail"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Senha"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repetir Senha"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-10 md:px-12 py-3 md:py-4 rounded-full mt-8 md:mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs min-w-[160px]"
            >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Cadastrar"}
            </button>
        </div>
    );

    const renderRecoverForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-2xl md:text-3xl font-black text-[#10B981] mb-4 md:mb-6">Recuperar</h2>
            <div className="w-10 h-1 bg-[#10B981] mb-6 md:mb-8 rounded-full"></div>
            <p className="text-slate-400 text-center text-[10px] md:text-xs font-semibold mb-6 md:mb-8 uppercase tracking-widest px-4">Enviaremos instruções para seu email</p>

            <div className="w-full max-w-sm space-y-4">
                <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Seu melhor email"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-3 md:py-4 px-6 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:text-xs"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-10 md:px-12 py-3 md:py-4 rounded-full mt-8 md:mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs min-w-[160px]"
            >
                Enviar link
            </button>

            <button type="button" onClick={() => setView('login')} className="text-[#10B981] font-bold text-[10px] md:text-xs mt-6 uppercase tracking-widest hover:underline transition-all flex items-center gap-2">
                <span className="material-icons-round text-sm">west</span> Voltar
            </button>
        </div>
    );

    const renderResetPasswordForm = () => (
        <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-2xl md:text-3xl font-black text-[#EF4444] mb-4 md:mb-6">Nova Senha</h2>
            <div className="w-10 h-1 bg-[#EF4444] mb-6 md:mb-8 rounded-full"></div>
            <p className="text-slate-400 text-center text-[10px] md:text-xs font-semibold mb-6 md:mb-8 uppercase tracking-widest px-4">Digite sua nova senha de acesso</p>

            <div className="w-full max-w-sm space-y-4">
                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#EF4444] transition-colors">lock</span>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="NOVA SENHA"
                        className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#EF4444]/20 rounded-xl py-4 pl-12 pr-6 font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:text-xs"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#EF4444] hover:bg-red-600 text-white font-black px-10 md:px-12 py-3 md:py-4 rounded-full mt-8 md:mt-10 shadow-lg shadow-red-500/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs min-w-[160px]"
            >
                Redefinir Senha
            </button>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f0f4f3] relative overflow-hidden">
            {/* ... */}
            <div className="w-full max-w-5xl md:h-auto bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row relative z-10 border border-white">
                <div className={`flex-1 overflow-y-auto bg-white order-2 ${!isLogin && view !== 'recover' && view !== 'activate' && view !== 'reset-password' ? 'md:order-2' : 'md:order-1'}`}>
                    <form onSubmit={handleSubmit} className="h-full">
                        {view === 'login' && renderLoginForm()}
                        {view === 'signup' && renderSignupForm()}
                        {view === 'recover' && renderRecoverForm()}
                        {view === 'activate' && renderActivateForm()}
                        {view === 'reset-password' && renderResetPasswordForm()}
                    </form>
                </div>

                {/* Transition Panel (The Green Side) */}
                <div className={`w-full md:w-[40%] bg-[#10B981] flex flex-col items-center justify-center p-8 md:p-12 text-white text-center relative overflow-hidden order-1 ${!isLogin && view !== 'recover' && view !== 'activate' && view !== 'reset-password' ? 'md:order-1' : 'md:order-2'}`}>
                    {/* ... existing content ... */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -translate-y-1/2 translate-x-1/2 rounded-full"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 translate-y-1/4 -translate-x-1/4 rotate-45"></div>

                    <div className="relative z-10 space-y-4 md:space-y-6">
                        {isLogin ? (
                            <>
                                <h2 className="text-3xl md:text-4xl font-black text-white">Olá, Amigo!</h2>
                                <p className="text-emerald-50/80 text-[11px] md:text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
                                    Insira seus dados pessoais e comece sua jornada com a gente.
                                </p>
                                <div className="w-10 h-1 bg-white/30 mx-auto rounded-full hidden md:block"></div>
                                <button
                                    type="button"
                                    onClick={() => setView('signup')}
                                    className="border-2 border-white text-white font-black px-10 md:px-12 py-2.5 md:py-3 rounded-full hover:bg-white hover:text-[#10B981] transition-all uppercase tracking-widest text-[9px] md:text-[10px] active:scale-95"
                                >
                                    Cadastrar
                                </button>
                            </>
                        ) : (
                            <>
                                <h2 className="text-3xl md:text-4xl font-black text-white">Bem-vindo!</h2>
                                <p className="text-emerald-50/80 text-[11px] md:text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
                                    Para manter-se conectado conosco, faça o login com suas informações.
                                </p>
                                <div className="w-10 h-1 bg-white/30 mx-auto rounded-full hidden md:block"></div>
                                <button
                                    type="button"
                                    onClick={() => setView('login')}
                                    className="border-2 border-white text-white font-black px-10 md:px-12 py-2.5 md:py-3 rounded-full hover:bg-white hover:text-[#10B981] transition-all uppercase tracking-widest text-[9px] md:text-[10px] active:scale-95"
                                >
                                    Entrar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Version Text */}
            <div className="fixed bottom-6 text-center w-full pointer-events-none">
                <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.3em] px-2">v2.4.0 • Leve Pedidos</p>
            </div>
        </div>
    );
};

export default AuthView;
