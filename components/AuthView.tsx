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

    const isLogin = initialView === 'login';

    const renderLoginForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-3xl font-black text-[#10B981] mb-6">Acessar Conta</h2>

            <div className="w-10 h-1 bg-[#10B981] mb-8 rounded-full"></div>

            {/* Social Icons */}
            <div className="flex gap-4 mb-8">
                {['f', 'G+', 'in'].map((icon) => (
                    <button key={icon} type="button" className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-800 font-bold hover:bg-slate-50 transition-all active:scale-90">
                        {icon === 'G+' ? <span className="text-sm font-black">G+</span> : <span className="material-icons-round text-xl">{icon === 'f' ? 'facebook' : icon}</span>}
                    </button>
                ))}
            </div>

            <p className="text-slate-400 text-xs font-semibold mb-8 uppercase tracking-widest">ou use seu email</p>

            {errorStatus && (
                <div className="w-full bg-rose-500/10 text-rose-500 p-3 rounded-xl text-[10px] font-bold text-center mb-4 uppercase tracking-tighter">
                    {errorStatus}
                </div>
            )}

            <div className="w-full space-y-4 max-w-sm">
                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors">mail</span>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Email"
                        className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all"
                    />
                </div>

                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors">lock</span>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Senha"
                        className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="w-full max-w-sm flex items-center justify-between mt-6 px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]" />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600">Lembrar-me</span>
                </label>
                <button type="button" onClick={() => navigate('/recuperar')} className="text-slate-500 text-xs font-bold hover:text-[#10B981] underline transition-colors">Esqueceu a senha?</button>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-12 py-4 rounded-full mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    "Entrar"
                )}
            </button>
        </div>
    );

    const renderSignupForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-3xl font-black text-[#10B981] mb-6">Criar Conta</h2>

            <div className="w-10 h-1 bg-[#10B981] mb-8 rounded-full"></div>

            <p className="text-slate-400 text-xs font-semibold mb-8 uppercase tracking-widest">Preencha seus dados para começar</p>

            {errorStatus && (
                <div className="w-full bg-rose-500/10 text-rose-500 p-3 rounded-xl text-[10px] font-bold text-center mb-4 uppercase tracking-tighter">
                    {errorStatus}
                </div>
            )}

            <div className="w-full space-y-3 max-w-sm">
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome Completo"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="E-mail"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Senha"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
                <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repetir Senha"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-12 py-4 rounded-full mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    "Cadastrar"
                )}
            </button>
        </div>
    );

    const renderRecoverForm = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 md:p-12 animate-in fade-in duration-700">
            <h2 className="text-3xl font-black text-[#10B981] mb-6">Recuperar</h2>
            <div className="w-10 h-1 bg-[#10B981] mb-8 rounded-full"></div>

            <p className="text-slate-400 text-center text-xs font-semibold mb-8 uppercase tracking-widest px-4">Enviaremos instruções para seu email</p>

            <div className="w-full max-w-sm space-y-4">
                <input
                    type="email"
                    required
                    placeholder="Seu melhor emali"
                    className="w-full bg-[#f4f8f7] border-none focus:ring-2 focus:ring-[#10B981]/20 rounded-xl py-4 px-6 text-sm text-slate-900 outline-none transition-all"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#0da673] text-white font-black px-12 py-4 rounded-full mt-10 shadow-lg shadow-[#10B981]/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
                Enviar link
            </button>

            <button type="button" onClick={() => navigate('/login')} className="text-[#10B981] font-bold text-xs mt-6 uppercase tracking-widest hover:underline transition-all flex items-center gap-2">
                <span className="material-icons-round text-sm">west</span>
                Voltar
            </button>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f0f4f3] relative overflow-hidden">
            {/* Background shapes inspired by the image */}
            <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-100 rounded-full blur-[80px] opacity-60"></div>
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-200 rounded-full blur-[100px] opacity-40"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none">
                <div className="absolute top-10 right-20 w-8 h-8 bg-slate-200 rotate-45 opacity-50"></div>
                <div className="absolute bottom-20 left-10 w-12 h-12 bg-slate-300 rounded-full opacity-30"></div>
                <div className="absolute top-40 left-1/4 w-4 h-4 bg-[#10B981] opacity-20"></div>
            </div>

            <div className="w-full max-w-5xl aspect-video lg:aspect-[1.8/1] bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:row relative z-10 border border-white">

                <div className={`flex flex-col md:flex-row w-full h-full transition-all duration-700 ease-in-out`}>

                    {/* Main Content Area (Form) */}
                    <div className={`flex-1 overflow-y-auto bg-white ${!isLogin && initialView !== 'recover' ? 'md:order-2' : 'md:order-1'}`}>
                        <form onSubmit={handleSubmit} className="h-full">
                            {initialView === 'login' && renderLoginForm()}
                            {initialView === 'signup' && renderSignupForm()}
                            {initialView === 'recover' && renderRecoverForm()}
                        </form>
                    </div>

                    {/* Transition Panel (The Green Side) */}
                    <div className={`w-full md:w-[40%] bg-[#10B981] flex flex-col items-center justify-center p-12 text-white text-center relative overflow-hidden ${!isLogin && initialView !== 'recover' ? 'md:order-1' : 'md:order-2'}`}>
                        {/* Decorative Background for the green panel */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -translate-y-1/2 translate-x-1/2 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 translate-y-1/4 -translate-x-1/4 rotate-45"></div>

                        <div className="relative z-10 space-y-6">
                            {isLogin ? (
                                <>
                                    <h2 className="text-4xl font-black text-white">Olá, Amigo!</h2>
                                    <p className="text-emerald-50/80 text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
                                        Insira seus dados pessoais e comece sua jornada com a gente.
                                    </p>
                                    <div className="w-10 h-1 bg-white/30 mx-auto rounded-full"></div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/cadastro')}
                                        className="border-2 border-white text-white font-black px-12 py-3 rounded-full hover:bg-white hover:text-[#10B981] transition-all uppercase tracking-widest text-[10px] active:scale-95"
                                    >
                                        Cadastrar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-4xl font-black text-white">Bem-vindo!</h2>
                                    <p className="text-emerald-50/80 text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
                                        Para manter-se conectado conosco, faça o login com suas informações.
                                    </p>
                                    <div className="w-10 h-1 bg-white/30 mx-auto rounded-full"></div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/login')}
                                        className="border-2 border-white text-white font-black px-12 py-3 rounded-full hover:bg-white hover:text-[#10B981] transition-all uppercase tracking-widest text-[10px] active:scale-95"
                                    >
                                        Entrar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Language / Theme toggles */}
            <div className="fixed bottom-6 right-6 flex items-center gap-4 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-white/40 shadow-xl z-20">
                <button
                    onClick={onToggleTheme}
                    className="p-3 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                >
                    <span className="material-icons-round">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">v2.4.0</p>
            </div>
        </div>
    );
};

export default AuthView;
