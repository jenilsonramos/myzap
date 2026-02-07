import React, { useState } from 'react';
import { useToast } from './ToastContext';

const ApiDocsView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'intro' | 'auth' | 'instances' | 'messages' | 'webhooks'>('intro');
    const baseUrl = window.location.origin + '/api';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Copiado para a área de transferência!', 'success');
    };

    const CodeBlock = ({ code, language = 'JSON' }: { code: string, language?: string }) => (
        <div className="relative group mt-4 mb-6 rounded-2xl overflow-hidden bg-slate-800 dark:bg-black/40 border border-slate-700 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-white/5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language}</span>
                <button
                    onClick={() => copyToClipboard(code)}
                    className="text-slate-400 hover:text-primary transition-colors"
                    title="Copiar"
                >
                    <span className="material-icons-round text-sm">content_copy</span>
                </button>
            </div>
            <pre className="p-5 overflow-x-auto custom-scrollbar">
                <code className="text-sm font-mono text-emerald-400 whitespace-pre">{code}</code>
            </pre>
        </div>
    );

    const Endpoint = ({ method, path, description }: { method: string, path: string, description: string }) => (
        <div className="flex flex-col gap-2 mb-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${method === 'GET' ? 'bg-blue-500/10 text-blue-500' :
                        method === 'POST' ? 'bg-emerald-500/10 text-emerald-500' :
                            method === 'DELETE' ? 'bg-rose-500/10 text-rose-500' :
                                'bg-orange-500/10 text-orange-500'
                    }`}>
                    {method}
                </span>
                <code className="text-sm font-mono text-slate-700 dark:text-slate-300">{path}</code>
            </div>
            <p className="text-xs text-slate-500 font-medium">{description}</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm w-fit">
                {[
                    { id: 'intro', label: 'Introdução' },
                    { id: 'auth', label: 'Autenticação' },
                    { id: 'instances', label: 'Instâncias' },
                    { id: 'messages', label: 'Mensagens' },
                    { id: 'webhooks', label: 'Webhooks' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? 'bg-primary text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-card-dark rounded-huge p-8 border border-slate-100 dark:border-white/5 shadow-xl min-h-[500px]">

                {activeTab === 'intro' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Documentação da API</h3>
                            <p className="text-slate-500 text-sm font-medium">Integre o MyZap ao seu sistema via REST API</p>
                        </div>

                        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Base URL</h4>
                            <div className="flex items-center gap-3">
                                <code className="text-sm font-mono text-slate-700 dark:text-slate-300">{baseUrl}</code>
                                <button onClick={() => copyToClipboard(baseUrl)} className="text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-icons-round text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                                <span className="material-icons-round text-emerald-500 mb-2">check_circle</span>
                                <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight mb-1">RESTful</h4>
                                <p className="text-xs text-emerald-600/60 dark:text-emerald-400/60 font-medium">Arquitetura padrão de mercado, fácil de implementar em qualquer linguagem.</p>
                            </div>
                            <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                                <span className="material-icons-round text-blue-500 mb-2">code</span>
                                <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight mb-1">JSON</h4>
                                <p className="text-xs text-blue-600/60 dark:text-blue-400/60 font-medium">Todas as requisições e respostas utilizam formato JSON.</p>
                            </div>
                            <div className="p-5 rounded-3xl bg-purple-500/5 border border-purple-500/10">
                                <span className="material-icons-round text-purple-500 mb-2">bolt</span>
                                <h4 className="text-sm font-black text-purple-600 dark:text-purple-400 uppercase tracking-tight mb-1">Real-time</h4>
                                <p className="text-xs text-purple-600/60 dark:text-purple-400/60 font-medium">Webhooks para receber mensagens e status instantaneamente.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'auth' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Autenticação</h3>
                            <p className="text-slate-500 text-sm font-medium">Segurança e acesso à API</p>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex gap-4 items-start">
                            <span className="material-icons-round text-amber-500 shrink-0">warning_amber</span>
                            <div>
                                <h4 className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight mb-1">Atenção</h4>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">
                                    Seu token de API concede acesso total à sua conta. Nunca o exponha em código client-side (frontend).
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Header Obrigatório</h4>
                            <p className="text-slate-500 text-xs font-medium mb-4">Todas as requisições devem incluir o cabeçalho Authorization.</p>
                            <CodeBlock code={`Authorization: Bearer SEU_TOKEN_AQUI`} language="HTTP" />
                        </div>
                    </div>
                )}

                {activeTab === 'instances' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Instâncias</h3>
                            <p className="text-slate-500 text-sm font-medium">Gerencie suas conexões do WhatsApp</p>
                        </div>

                        <Endpoint method="GET" path="/instances" description="Lista todas as instâncias conectadas e seus status." />

                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exemplo de Resposta</h4>
                        <CodeBlock code={`[
  {
    "id": 1,
    "name": "Atendimento",
    "status": "connected",
    "battery": 85
  },
  {
    "id": 2,
    "name": "Vendas",
    "status": "disconnected",
    "battery": null
  }
]`} />
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Mensagens</h3>
                            <p className="text-slate-500 text-sm font-medium">Envie textos e mídias para seus contatos</p>
                        </div>

                        {/* Send Text Section */}
                        <div className="pb-8 border-b border-slate-100 dark:border-white/5">
                            <Endpoint method="POST" path="/messages/send-text" description="Envia uma mensagem de texto simples." />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Parâmetros do Body</h4>
                                    <div className="space-y-3">
                                        {[
                                            { param: 'instanceName', type: 'string', desc: 'Nome da instância que enviará a mensagem' },
                                            { param: 'number', type: 'string', desc: 'Número do destinatário (com código do país)' },
                                            { param: 'text', type: 'string', desc: 'Conteúdo da mensagem' },
                                        ].map(p => (
                                            <div key={p.param} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-mono text-xs text-primary font-bold">{p.param}</span>
                                                    <span className="text-[9px] uppercase font-black text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{p.type}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-medium">{p.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exemplo JSON</h4>
                                    <CodeBlock code={`{
  "instanceName": "Atendimento",
  "number": "5511999999999",
  "text": "Olá! Sua encomenda chegou."
}`} />
                                </div>
                            </div>
                        </div>

                        {/* Send Media Section */}
                        <div className="pt-4">
                            <Endpoint method="POST" path="/messages/send-media" description="Envia imagem, vídeo ou documento via URL." />

                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exemplo JSON</h4>
                            <CodeBlock code={`{
  "instanceName": "Atendimento",
  "number": "5511999999999",
  "mediaUrl": "https://exemplo.com/fatura.pdf",
  "mediaType": "document", // image, video, document, audio
  "caption": "Segue sua fatura em anexo"
}`} />
                        </div>
                    </div>
                )}

                {activeTab === 'webhooks' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Webhooks</h3>
                            <p className="text-slate-500 text-sm font-medium">Receba notificações de eventos em tempo real</p>
                        </div>

                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                                    <span className="material-icons-round text-2xl">webhook</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black dark:text-white uppercase tracking-tight">Configuração</h4>
                                    <p className="text-xs text-slate-500 font-medium">Configure a URL de callback nas configurações do sistema.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payload: Mensagem Recebida</h4>
                            <CodeBlock code={`{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0..."
    },
    "message": {
      "conversation": "Quero falar com um atendente"
    },
    "instance": "Atendimento",
    "timestamp": 1678900000
  }
}`} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiDocsView;
