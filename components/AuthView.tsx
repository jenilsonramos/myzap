
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
                if (!response.ok) throw new Error(data.error || 'Erro no cadastro.');

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

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Falha no login.');


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

    const renderLoginForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Email</label>
                <div className="relative group">
                    <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">alternate_email</span>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="seu@email.com"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Senha</label>
                    <button type="button" onClick={() => navigate('/recuperar')} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter">Esqueceu a senha?</button>
                </div>
                <div className="relative group">
                    <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">lock</span>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <span>Entrar no Sistema</span>
                        <span className="material-icons-round">login</span>
                    </>
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Novo por aqui? {' '}
                    <button type="button" onClick={() => navigate('/cadastro')} className="text-primary font-bold hover:underline">Criar conta grátis</button>
                </p>
            </div>
        </div>
    );

    const renderSignupForm = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Nome Completo</label>
                <div className="relative group">
                    <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">person</span>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu nome"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Email</label>
                <div className="relative group">
                    <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">alternate_email</span>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="exemplo@email.com"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Senha</label>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Confirmar</label>
                    <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 px-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 mt-4"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <span>Finalizar Cadastro</span>
                        <span className="material-icons-round">how_to_reg</span>
                    </>
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Já tem conta? {' '}
                    <button type="button" onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">Fazer Login</button>
                </p>
            </div>
        </div>
    );

    const renderRecoverForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-icons-round text-3xl">lock_open</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recuperar Senha</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Enviaremos as instruções para o seu email.</p>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Email</label>
                <div className="relative group">
                    <span className="material-icons-round absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">alternate_email</span>
                    <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                    <>
                        <span>Enviar Link</span>
                        <span className="material-icons-round">send</span>
                    </>
                )}
            </button>

            <div className="text-center">
                <button type="button" onClick={() => navigate('/login')} className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    Voltar para o login
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex overflow-hidden relative bg-white dark:bg-slate-950">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="hidden lg:flex flex-1 flex-col justify-center px-20 relative z-10">
                <div className="max-w-md space-y-6">
                    <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40 rotate-12 hover:rotate-0 transition-all duration-700">
                        <span className="material-icons-round text-white text-5xl">hub</span>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">
                            MyZap <span className="text-primary italic">Pro.</span>
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                            O controle total das suas instâncias Evolution API em um painel premium e ultra veloz.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative z-20">
                <button
                    onClick={onToggleTheme}
                    className="absolute top-8 right-8 w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-slate-400"
                >
                    <span className="material-icons-round">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>

                <div className="w-full max-w-md">
                    <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl p-8 lg:p-12 rounded-[2.5rem] shadow-2xl border border-white dark:border-white/5 ring-1 ring-black/5 relative overflow-hidden">
                        <form onSubmit={handleSubmit} className="relative z-10">
                            {initialView === 'login' && renderLoginForm()}
                            {initialView === 'signup' && renderSignupForm()}
                            {initialView === 'recover' && renderRecoverForm()}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthView;
