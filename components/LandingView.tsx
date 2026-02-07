import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LandingViewProps {
    isAuthenticated: boolean;
}

const LandingView: React.FC<LandingViewProps> = ({ isAuthenticated }) => {
    const navigate = useNavigate();

    const plans = [
        {
            name: 'Básico',
            price: 'R$ 97',
            period: '/mês',
            features: ['1 Instância WhatsApp', 'Mensagens Ilimitadas', 'Suporte via Ticket', 'Dashboard Básico'],
            recommended: false,
        },
        {
            name: 'Profissional',
            price: 'R$ 197',
            period: '/mês',
            features: ['5 Instâncias WhatsApp', 'Multi-chat Atendimento', 'Chatbot com IA', 'Relatórios Avançados'],
            recommended: true,
        },
        {
            name: 'Enterprise',
            price: 'R$ 497',
            period: '/mês',
            features: ['Instâncias Ilimitadas', 'API de Integração', 'Gerente de Contas', 'Personalização Total'],
            recommended: false,
        }
    ];

    const features = [
        { icon: 'bolt', title: 'Automação Rápida', description: 'Crie fluxos de atendimento em minutos sem precisar programar.' },
        { icon: 'forum', title: 'Multi-atendimento', description: 'Vários atendentes em um único número de WhatsApp.' },
        { icon: 'smart_toy', title: 'IA Integrada', description: 'Respostas inteligentes baseadas em inteligência artificial avançada.' },
        { icon: 'insights', title: 'Relatórios', description: 'Acompanhe o desempenho da sua equipe em tempo real.' },
        { icon: 'security', title: 'Segurança', description: 'Seus dados e de seus clientes estão sempre protegidos por criptografia.' },
        { icon: 'api', title: 'API Robusta', description: 'Integre o MyZap com suas ferramentas favoritas facilmente.' }
    ];

    const faqs = [
        { q: 'Como funciona o teste grátis?', a: 'Você tem 7 dias para usar todas as funcionalidades do plano Profissional sem pagar nada.' },
        { q: 'Posso cancelar a qualquer momento?', a: 'Sim, não temos contrato de fidelidade. Você pode cancelar sua assinatura quando desejar.' },
        { q: 'Preciso de um número novo?', a: 'Não, você pode usar seu número atual do WhatsApp Business ou pessoal.' }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/30">

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                <span className="material-icons-round text-white">bolt</span>
                            </div>
                            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-500">MyZap</span>
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-semibold hover:text-primary transition-colors">Funcionalidades</a>
                            <a href="#pricing" className="text-sm font-semibold hover:text-primary transition-colors">Planos</a>
                            <a href="#faq" className="text-sm font-semibold hover:text-primary transition-colors">FAQ</a>
                        </div>

                        <div className="flex items-center gap-4">
                            {isAuthenticated ? (
                                <button
                                    onClick={() => navigate('/analytics')}
                                    className="bg-primary hover:bg-primary-hover text-white px-8 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <span className="material-icons-round text-sm">dashboard</span>
                                    Acessar Painel
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="text-sm font-bold hover:text-primary transition-colors px-4"
                                    >
                                        Entrar
                                    </button>
                                    <button
                                        onClick={() => navigate('/cadastro')}
                                        className="bg-primary hover:bg-primary-hover text-white px-8 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                    >
                                        Criar Conta
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2 rounded-full mb-8 shadow-xl shadow-indigo-500/20">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest">7 Dias de Teste Grátis</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Revolucione seu Atendimento <br /> via <span className="text-primary italic">WhatsApp</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg text-slate-500 dark:text-slate-400 mb-10 font-medium">
                        Conecte sua empresa ao futuro. Centralize conversas, automatize respostas e venda mais com a plataforma de automação líder do mercado.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate(isAuthenticated ? '/analytics' : '/cadastro')}
                            className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white px-10 py-4 rounded-2xl text-lg font-black transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2 group"
                        >
                            {isAuthenticated ? 'Voltar ao Painel' : 'Começar Agora'}
                            <span className="material-icons-round group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                        {!isAuthenticated && (
                            <button className="w-full sm:w-auto bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-10 py-4 rounded-2xl text-lg font-black hover:bg-slate-200 dark:hover:bg-slate-800 transition-all font-bold">
                                Ver Demonstração
                            </button>
                        )}
                    </div>

                    {/* Hero Decorative Image placeholder - using a styled div */}
                    <div className="mt-20 relative max-w-5xl mx-auto">
                        <div className="absolute -inset-4 bg-gradient-to-r from-primary to-emerald-500 rounded-[3rem] blur-3xl opacity-20 animate-pulse"></div>
                        <div className="relative bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 aspect-video overflow-hidden shadow-2xl">
                            <div className="absolute top-0 left-0 right-0 h-10 bg-white/50 dark:bg-white/5 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center px-6 gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                            </div>
                            <div className="p-12 h-full flex items-center justify-center">
                                <div className="text-slate-400 dark:text-slate-600 font-black text-2xl uppercase tracking-widest opacity-20">Preview da Plataforma</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 bg-slate-50 dark:bg-slate-900/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4">Potencialize seu Negócio</h2>
                        <p className="text-slate-500 dark:text-slate-400">Recursos poderosos para levar seu atendimento ao próximo nível.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((f, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/5 group">
                                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                    <span className="material-icons-round text-3xl">{f.icon}</span>
                                </div>
                                <h3 className="text-xl font-black mb-3">{f.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4">Planos que Crescem com Você</h2>
                        <p className="text-slate-500 dark:text-slate-400">Escolha a melhor opção para transformar seu atendimento hoje.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                        {plans.map((p, i) => (
                            <div key={i} className={`relative flex flex-col p-10 rounded-[2.5rem] border ${p.recommended ? 'border-primary ring-4 ring-primary/5 bg-primary/5 shadow-2xl' : 'border-slate-200 dark:border-white/10'} hover:scale-105 transition-all duration-500`}>
                                {p.recommended && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-6 py-1.5 rounded-full whitespace-nowrap shadow-lg shadow-primary/20">
                                        Mais Popular
                                    </div>
                                )}
                                <div className="mb-8">
                                    <h3 className="text-xl font-black mb-4">{p.name}</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black">{p.price}</span>
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{p.period}</span>
                                    </div>
                                </div>
                                <ul className="flex-1 space-y-4 mb-10">
                                    {p.features.map((feat, fi) => (
                                        <li key={fi} className="flex items-center gap-3 text-sm font-medium">
                                            <span className="material-icons-round text-emerald-500 text-lg">check_circle</span>
                                            {feat}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => navigate('/cadastro')}
                                    className={`w-full py-4 rounded-2xl font-black transition-all ${p.recommended ? 'bg-primary text-white shadow-xl shadow-primary/25 hover:bg-primary-hover' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}
                                >
                                    Assinar Agora
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="py-24 bg-slate-50 dark:bg-slate-900/30">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-black tracking-tighter mb-12 text-center">Perguntas Frequentes</h2>
                    <div className="space-y-6">
                        {faqs.map((f, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-white/5">
                                <h4 className="text-lg font-black mb-3">{f.q}</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20 text-center md:text-left">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
                                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                    <span className="material-icons-round text-white text-lg">bolt</span>
                                </div>
                                <span className="text-xl font-black tracking-tighter">MyZap</span>
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                A plataforma completa para automação de WhatsApp empresarial. Transforme sua comunicação.
                            </p>
                        </div>
                        <div>
                            <h5 className="font-black mb-6 uppercase text-xs tracking-widest text-slate-400">Produto</h5>
                            <ul className="space-y-4 text-sm font-semibold text-slate-500">
                                <li><a href="#features" className="hover:text-primary transition-colors">Funcionalidades</a></li>
                                <li><a href="#pricing" className="hover:text-primary transition-colors">Planos</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Demonstração</a></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-black mb-6 uppercase text-xs tracking-widest text-slate-400">Empresa</h5>
                            <ul className="space-y-4 text-sm font-semibold text-slate-500">
                                <li><a href="#" className="hover:text-primary transition-colors">Sobre Nós</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-black mb-6 uppercase text-xs tracking-widest text-slate-400">Suporte</h5>
                            <ul className="space-y-4 text-sm font-semibold text-slate-500">
                                <li><a href="#" className="hover:text-primary transition-colors">Central de Ajuda</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">API Docs</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Status</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-10 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-xs text-slate-400 font-bold">© 2024 MyZap. Todos os direitos reservados.</p>
                        <div className="flex items-center gap-8">
                            <a href="#" className="text-xs font-bold text-slate-400 hover:text-primary">Termos</a>
                            <a href="#" className="text-xs font-bold text-slate-400 hover:text-primary">Privacidade</a>
                            <div className="flex gap-4 ml-4">
                                <span className="material-icons-round text-slate-300 dark:text-slate-700 hover:text-primary cursor-pointer transition-colors">facebook</span>
                                <span className="material-icons-round text-slate-300 dark:text-slate-700 hover:text-primary cursor-pointer transition-colors">instagram</span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingView;
