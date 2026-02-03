
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext';

interface AuthViewProps {
    onLogin: (data: any) => void;
    onSignup: (data: any) => void;
    onRecover: (email: string) => void;
    initialView?: 'login' | 'signup' | 'recover';
    onToggleTheme: () => void;
    isDarkMode: boolean;
}

const AuthView: React.FC<AuthViewProps> = ({
    onLogin,
    onSignup,
    onRecover,
    initialView = 'login',
    onToggleTheme,
    isDarkMode
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

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
            console.log('Starting Auth Action:', initialView);
            if (initialView === 'signup') {
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('As senhas não coincidem.');
                }

                console.log('Registering user...');
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
                if (!response.ok) {
                    const errorMsg = data.details ? `${data.error} (${data.details})` : (data.error || 'Erro no cadastro.');
                    throw new Error(errorMsg);
                }

                console.log('Signup success! Showing toast...');
                showToast('Cadastro realizado com sucesso!', 'success');

                // --- AUTO LOGIN ---
                console.log('Attempting auto-login...');
                const loginResponse = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password
                    })
                });

                const loginData = await loginResponse.json();
                if (!loginResponse.ok) {
                    console.error('Auto-login failed:', loginData.error);
                    throw new Error(loginData.error || 'Erro ao realizar login automático.');
                }

                console.log('Auto-login success! Updating local storage and parent state...');
                localStorage.setItem('myzap_token', loginData.token);
                localStorage.setItem('myzap_user', JSON.stringify(loginData.user));
                localStorage.setItem('myzap_auth', 'true');
                onLogin(loginData);
                // ------------------

            } else if (initialView === 'login') {
                console.log('Logging in user...');
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password
                    })
                });

                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    console.error('Server returned non-JSON response:', text.substring(0, 100));
                    throw new Error('Servidor da API não está respondendo corretamente. Por favor, reinicie o backend no VPS.');
                }

                if (!response.ok) throw new Error(data?.error || 'Falha no login.');

                console.log('Login success! Storing token and user data...');
                localStorage.setItem('myzap_auth', 'true');
                localStorage.setItem('myzap_token', data.token); // Essencial para requisições autenticadas
                localStorage.setItem('myzap_user', JSON.stringify(data.user));

                showToast(`Bem-vindo de volta, ${data.user.name}!`, 'success');
                onLogin(data);
            }
        } catch (err: any) {
            console.error('Auth Workflow Error:', err);
            setErrorStatus(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const [passwordStrength, setPasswordStrength] = useState(0);

    const checkPasswordStrength = (pass: string) => {
        let strength = 0;
        if (pass.length >= 8) strength += 25;
        if (/[A-Z]/.test(pass)) strength += 25;
        if (/[0-9]/.test(pass)) strength += 25;
        if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
        setPasswordStrength(strength);
    };

    const getStrengthColor = () => {
        if (passwordStrength <= 25) return 'bg-rose-500';
        if (passwordStrength <= 50) return 'bg-orange-500';
        if (passwordStrength <= 75) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    const renderLoginForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12 group-hover:rotate-0 transition-transform duration-500 shadow-xl shadow-primary/5 border border-primary/20">
                    <span className="material-icons-round text-primary text-4xl">hub</span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Bem-vindo ao MyZap</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Sua central premium de Evolution API</p>
            </div>

            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-2 group">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1 group-focus-within:text-primary transition-colors">Email de Acesso</label>
                    <div className="relative">
                        <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 opacity-50">mail</span>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="seu@email.com"
                            className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="space-y-2 group">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-primary transition-colors">Senha</label>
                        <button type="button" onClick={() => navigate('/recuperar')} className="text-[10px] font-black text-primary hover:underline uppercase tracking-tighter">Esqueceu?</button>
                    </div>
                    <div className="relative">
                        <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 opacity-50">lock</span>
                        <input
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                            className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <span className="uppercase tracking-[0.2em] text-xs">Acessar Painel</span>
                        <span className="material-icons-round text-lg">arrow_forward</span>
                    </>
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Novo no MyZap? {' '}
                    <button type="button" onClick={() => navigate('/cadastro')} className="text-primary font-black hover:underline">Quero uma conta grátis</button>
                </p>
            </div>
        </div>
    );

    const renderSignupForm = () => (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Crie sua Conta</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Comece a gerenciar suas instâncias agora!</p>
            </div>

            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Nome Completo</label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Como devemos te chamar?"
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-[1.25rem] py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Melhor Email</label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="exemplo@email.com"
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-[1.25rem] py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Crie uma Senha Forte</label>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            checkPasswordStrength(e.target.value);
                        }}
                        placeholder="••••••••"
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-[1.25rem] py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />

                    {/* Password Strength Meter */}
                    {formData.password && (
                        <div className="px-2 pt-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Segurança da Senha</span>
                                <span className={`text-[9px] font-black uppercase tracking-tighter ${getStrengthColor().replace('bg-', 'text-')}`}>
                                    {passwordStrength <= 25 ? 'Fraca' : passwordStrength <= 50 ? 'Razoável' : passwordStrength <= 75 ? 'Boa' : 'Excelente!'}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${getStrengthColor()}`}
                                    style={{ width: `${passwordStrength}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Repita a Senha</label>
                    <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-[1.25rem] py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || (passwordStrength < 50 && initialView === 'signup')}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-[1.25rem] shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 mt-4 active:scale-[0.98] disabled:opacity-50"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                    <>
                        <span className="uppercase tracking-[0.2em] text-xs">Criar Minha Conta</span>
                        <span className="material-icons-round text-lg">check_circle</span>
                    </>
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Já é de casa? {' '}
                    <button type="button" onClick={() => navigate('/login')} className="text-primary font-black hover:underline">Fazer Login</button>
                </p>
            </div>
        </div>
    );

    const renderRecoverForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons-round text-4xl">key</span>
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Recuperar Senha</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Sem problemas! Acontece com os melhores.</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Email para Recuperação</label>
                    <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        className="w-full bg-slate-100/50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-[1.25rem] py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-black py-5 rounded-[1.25rem] shadow-2xl shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <span className="uppercase tracking-[0.2em] text-xs">Enviar Instruções</span>
                        <span className="material-icons-round">send</span>
                    </>
                )}
            </button>

            <div className="text-center">
                <button type="button" onClick={() => navigate('/login')} className="text-xs font-black uppercase text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto tracking-widest">
                    <span className="material-icons-round text-lg">west</span>
                    Voltar ao Login
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden bg-[#f8fafc] dark:bg-slate-950">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

            <button
                onClick={onToggleTheme}
                className="fixed top-8 right-8 w-12 h-12 bg-white dark:bg-white/5 backdrop-blur-xl border border-white dark:border-white/5 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-500 dark:text-slate-400 z-50 shadow-xl"
            >
                <span className="material-icons-round">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>

            <div className="w-full max-w-xl relative group z-10 transition-all duration-700">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-8 md:p-14 rounded-[2.75rem] shadow-2xl border border-white dark:border-white/10">
                    <form onSubmit={handleSubmit}>
                        {initialView === 'login' && renderLoginForm()}
                        {initialView === 'signup' && renderSignupForm()}
                        {initialView === 'recover' && renderRecoverForm()}
                    </form>
                </div>
            </div>

            {/* Footer Text */}
            <div className="fixed bottom-8 left-0 right-0 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 dark:text-slate-600">
                    Premium Dashboard Experience • Evolution API v2
                </p>
            </div>
        </div>
    );
};

export default AuthView;
