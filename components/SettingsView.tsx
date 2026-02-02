import React, { useState } from 'react';
import { useToast } from './ToastContext';

const SettingsView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'webhook' | 'security'>('profile');

    // Dados Reais do Usuário
    const user = JSON.parse(localStorage.getItem('myzap_user') || '{}');
    const [profileData, setProfileData] = useState({
        name: user.name || 'Admin',
        email: user.email || '',
        role: 'Project Owner',
        phone: localStorage.getItem('myzap_phone') || '+55 11 99999-9999',
        avatar: localStorage.getItem('myzap_avatar') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
    });

    const handleSave = () => {
        localStorage.setItem('myzap_user', JSON.stringify({ ...user, name: profileData.name, email: profileData.email }));
        localStorage.setItem('myzap_avatar', profileData.avatar);
        window.dispatchEvent(new Event('profileUpdate')); // Notifica o Header
        showToast('Configurações salvas com sucesso!');
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileData({ ...profileData, avatar: reader.result as string });
                showToast('Foto carregada! Clique em salvar para aplicar.', 'info');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Settings Navigation Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    Perfil
                </button>
                <button
                    onClick={() => setActiveTab('api')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'api' ? 'bg-primary text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    API
                </button>
                <button
                    onClick={() => setActiveTab('webhook')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'webhook' ? 'bg-primary text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    Webhook
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'bg-primary text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    Segurança
                </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl min-h-[500px]">
                {activeTab === 'profile' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-slate-50 dark:border-slate-800 shadow-xl group-hover:opacity-80 transition-all bg-slate-100 dark:bg-slate-800">
                                    <img src={profileData.avatar} alt="Profile" className="w-full h-full object-cover" />
                                </div>
                                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all cursor-pointer">
                                    <span className="material-icons-round text-sm">photo_camera</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                                </label>
                            </div>
                            <div>
                                <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Informações de Perfil</h3>
                                <p className="text-slate-500 text-sm font-medium">Gerencie como você é visto no MyZap</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={profileData.name}
                                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Profissional</label>
                                <input
                                    type="email"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                                <input
                                    type="text"
                                    value={profileData.role}
                                    onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                                <input
                                    type="text"
                                    value={profileData.phone}
                                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Configurações de API</h3>
                            <p className="text-slate-500 text-sm font-medium">Chaves e credenciais para integração MyZap</p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/5 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Evolution API URL</label>
                                <div className="relative">
                                    <input type="text" readOnly value="https://api.myzap.chat" className="w-full bg-white dark:bg-card-dark border-none rounded-2xl px-5 py-4 text-sm dark:text-white pr-12 font-mono" />
                                    <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-primary transition-colors">content_copy</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global API Token</label>
                                <div className="relative">
                                    <input type="password" readOnly value="************************" className="w-full bg-white dark:bg-card-dark border-none rounded-2xl px-5 py-4 text-sm dark:text-white pr-12 font-mono" />
                                    <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-primary transition-colors">visibility</span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic mt-1 ml-1">Nunca compartilhe sua chave de API com ninguém.</p>
                            </div>
                        </div>

                        <button className="flex items-center gap-2 text-indigo-500 text-xs font-black uppercase tracking-widest hover:text-indigo-600 transition-colors">
                            <span className="material-icons-round text-lg">autorenew</span>
                            Regerar Chaves de API
                        </button>
                    </div>
                )}

                {activeTab === 'webhook' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Global Webhooks</h3>
                            <p className="text-slate-500 text-sm font-medium">Receba eventos em tempo real em seu servidor</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                                        <span className="material-icons-round">link</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black dark:text-white uppercase">Webhook de Mensagens</h4>
                                        <p className="text-[10px] text-slate-500 font-bold tracking-widest">https://seu-site.com/webhook</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button className="text-slate-400 hover:text-primary transition-colors">
                                        <span className="material-icons-round">settings</span>
                                    </button>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>

                            <button className="w-full py-5 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-3">
                                <span className="material-icons-round">add_circle_outline</span>
                                Adicionar Novo Webhook
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Segurança da Conta</h3>
                            <p className="text-slate-500 text-sm font-medium">Proteja seu acesso e autenticação</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alterar Senha</h4>
                                <div className="space-y-4">
                                    <input type="password" placeholder="Senha Atual" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none" />
                                    <input type="password" placeholder="Nova Senha" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none" />
                                    <input type="password" placeholder="Confirmar Nova Senha" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm dark:text-white focus:ring-2 focus:ring-primary transition-all outline-none" />
                                </div>
                            </div>

                            <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-huge p-6 space-y-4 h-fit">
                                <div className="flex items-center gap-3 text-rose-500">
                                    <span className="material-icons-round text-2xl">warning_amber</span>
                                    <h4 className="text-sm font-black uppercase tracking-tight">Área Crítica</h4>
                                </div>
                                <p className="text-xs text-rose-500/70 font-medium leading-relaxed">
                                    Ao excluir sua conta, todas as suas instâncias, contatos e fluxos serão removidos permanentemente sem possibilidade de recuperação.
                                </p>
                                <button className="w-full py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">
                                    Excluir minha conta
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
                    <button className="px-8 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        Descartar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-10 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
