
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

    const renderLoginForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center lg:text-left mb-8">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Entrar na Conta</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Bem-vindo de volta! Por favor, insira seus dados.</p>
            </div>

            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none">
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Entrar com Google</span>
                </button>
                <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none">
                    <img src="https://www.facebook.com/favicon.ico" className="w-4 h-4" alt="Facebook" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Entrar com Facebook</span>
                </button>
            </div>

            <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/5"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-4 text-slate-400 font-bold tracking-widest">-OU-</span></div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="seu@email.com"
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Senha</label>
                        <button type="button" onClick={() => navigate('/recuperar')} className="material-icons-round text-lg text-slate-400 hover:text-primary transition-colors">visibility_off</button>
                    </div>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all uppercase tracking-widest text-xs mt-4"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                    "Entrar no Sistema"
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ainda não tem conta? {' '}
                    <button type="button" onClick={() => navigate('/cadastro')} className="text-indigo-600 font-black hover:underline">Cadastre-se</button>
                </p>
            </div>
        </div>
    );

    const renderSignupForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center lg:text-left mb-8">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Criar Conta</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Junte-se a nós e comece sua jornada hoje!</p>
            </div>

            {errorStatus && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-bold text-center">
                    {errorStatus}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none">
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Sign up with Google</span>
                </button>
                <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none">
                    <img src="https://www.facebook.com/favicon.ico" className="w-4 h-4" alt="Facebook" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Sign up with Facebook</span>
                </button>
            </div>

            <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/5"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-4 text-slate-400 font-bold tracking-widest">-OR-</span></div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo:</label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email:</label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Senha:</label>
                        <span className="material-icons-round text-lg text-slate-400">visibility_off</span>
                    </div>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all uppercase tracking-widest text-xs mt-4"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                    "Criar Minha Conta"
                )}
            </button>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Já tem uma conta? {' '}
                    <button type="button" onClick={() => navigate('/login')} className="text-indigo-600 font-black hover:underline">Fazer Login</button>
                </p>
            </div>
        </div>
    );

    const renderRecoverForm = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center lg:text-left mb-8">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">Recuperar Senha</h2>
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mt-4 mb-2">
                    <span className="material-icons-round text-3xl">lock_reset</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Enviaremos orientações para seu email.</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                    <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-white/10 py-3 px-4 text-sm text-slate-900 dark:text-white outline-none transition-all"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs mt-4"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                ) : (
                    "Enviar Link de Recuperação"
                )}
            </button>

            <div className="text-center">
                <button type="button" onClick={() => navigate('/login')} className="text-sm text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto font-bold uppercase tracking-tighter">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    Voltar ao Login
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f2f5] dark:bg-slate-950 p-4 lg:p-12">
            <div className="w-full max-w-6xl aspect-[16/9] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_20px_100px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col lg:flex-row border border-white/20">

                {/* Lado Esquerdo - Ilustração e Branding */}
                <div className="hidden lg:flex w-2/5 bg-[#cbd5ff] dark:bg-indigo-950/50 p-12 flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                        <div className="w-12 h-12 bg-white/30 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-lg">
                            <span className="material-icons-round text-slate-800 dark:text-white">hub</span>
                        </div>
                        <div className="space-y-2">
                            <p className="text-slate-700 dark:text-indigo-200 text-lg leading-relaxed font-bold">
                                Nós da MyZap estamos focados em escalar suas vendas e atendimentos.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex justify-center items-center py-8">
                        <img
                            src="/C:/Users/levepedidos/.gemini/antigravity/brain/231c0009-ee8c-4f02-9be0-c50e2319e30c/auth_side_illustration_1770115987582.png"
                            alt="3D Illustration"
                            className="w-full max-w-[280px] drop-shadow-2xl animate-float"
                        />
                        <style>{`
                            @keyframes float {
                                0%, 100% { transform: translateY(0px) rotate(0deg); }
                                50% { transform: translateY(-15px) rotate(2deg); }
                            }
                            .animate-float { animation: float 6s ease-in-out infinite; }
                        `}</style>
                    </div>

                    <div className="relative z-10 text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400/60 text-center">
                        Evolution API Dashboard
                    </div>

                    {/* Elementos Decorativos de Fundo */}
                    <div className="absolute top-[-10%] left-[-10%] w-full h-full bg-indigo-400/10 blur-[100px] rounded-full"></div>
                </div>

                {/* Lado Direito - Formulário */}
                <div className="flex-1 flex flex-col p-8 lg:p-16 relative overflow-y-auto custom-scrollbar">
                    {/* Botão de Idioma / Tema (Topo Direito) */}
                    <div className="flex justify-end gap-2 mb-8">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors">
                            English(US) <span className="material-icons-round text-sm">expand_more</span>
                        </div>
                        <button
                            onClick={onToggleTheme}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span className="material-icons-round text-lg">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                    </div>

                    <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
                        <form onSubmit={handleSubmit}>
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
