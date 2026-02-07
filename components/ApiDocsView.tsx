import React, { useState } from 'react';

const ApiDocsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('intro');
    const [baseUrl, setBaseUrl] = useState(window.location.origin + '/api');

    const tabs = [
        { id: 'intro', label: 'Introdução', icon: 'info' },
        { id: 'auth', label: 'Autenticação', icon: 'vpn_key' },
        { id: 'instances', label: 'Instâncias', icon: 'dns' },
        { id: 'messages', label: 'Mensagens', icon: 'send' },
        { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
    ];

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Toast logic would go here
    };

    const CodeBlock = ({ code, language = 'json' }: { code: string, language?: string }) => (
        <div className="relative group mt-4 mb-6 rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-white/5">
                <span className="text-xs font-mono text-white/40">{language}</span>
                <button
                    onClick={() => copyToClipboard(code)}
                    className="text-white/40 hover:text-white transition-colors"
                    title="Copiar"
                >
                    <span className="material-icons-round text-sm">content_copy</span>
                </button>
            </div>
            <pre className="p-4 overflow-x-auto custom-scrollbar">
                <code className="text-sm font-mono text-blue-300 whitespace-pre">{code}</code>
            </pre>
        </div>
    );

    const Endpoint = ({ method, path, description }: { method: string, path: string, description: string }) => (
        <div className="flex flex-col gap-2 mb-6 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold ${method === 'GET' ? 'bg-blue-500/20 text-blue-300' :
                    method === 'POST' ? 'bg-emerald-500/20 text-emerald-300' :
                        method === 'DELETE' ? 'bg-rose-500/20 text-rose-300' :
                            'bg-orange-500/20 text-orange-300'
                    }`}>
                    {method}
                </span>
                <code className="text-sm font-mono text-white/80">{path}</code>
            </div>
            <p className="text-sm text-white/60">{description}</p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="flex flex-col gap-1 mb-8 shrink-0">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Documentação da API
                </h1>
                <p className="text-white/60">Integre o seu sistema com o MyZap via API REST.</p>
            </div>

            <div className="flex flex-1 gap-8 min-h-0">
                {/* Sidebar Navigation */}
                <div className="w-64 shrink-0 flex flex-col gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeTab === tab.id
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="material-icons-round text-xl">{tab.icon}</span>
                            <span className="font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-20">
                    <div className="max-w-3xl">

                        {activeTab === 'intro' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold mb-6 text-white">Introdução</h2>
                                <p className="text-white/70 mb-6 leading-relaxed">
                                    A API do MyZap permite que você envie mensagens, gerencie instâncias e receba eventos em tempo real via Webhooks.
                                    Todas as respostas são em formato JSON.
                                </p>

                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold mb-3 text-white/90">Base URL</h3>
                                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-emerald-400">
                                        {baseUrl}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'auth' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold mb-6 text-white">Autenticação</h2>
                                <p className="text-white/70 mb-6">
                                    Todas as requisições devem incluir o cabeçalho <code className="bg-white/10 px-1 rounded">Authorization</code> com o seu Token de API.
                                </p>

                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-8">
                                    <h4 className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                                        <span className="material-icons-round">warning</span>
                                        Importante
                                    </h4>
                                    <p className="text-amber-200/80 text-sm">
                                        Seu token de API concede acesso total à sua conta. Mantenha-o seguro e não o compartilhe.
                                    </p>
                                </div>

                                <h3 className="text-lg font-semibold mb-3 text-white/90">Exemplo de Header</h3>
                                <CodeBlock code={`Authorization: Bearer SEU_TOKEN_AQUI`} language="http" />
                            </div>
                        )}

                        {activeTab === 'instances' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold mb-6 text-white">Instâncias</h2>

                                <Endpoint method="GET" path="/instances" description="Lista todas as instâncias conectadas e seus status." />

                                <h3 className="text-lg font-semibold mb-3 text-white/90">Exemplo de Resposta</h3>
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
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold mb-6 text-white">Mensagens</h2>

                                <Endpoint method="POST" path="/messages/send-text" description="Envia uma mensagem de texto simples." />

                                <h3 className="text-lg font-semibold mb-3 text-white/90">Body (JSON)</h3>
                                <CodeBlock code={`{
  "instanceName": "Atendimento",
  "number": "5511999999999",
  "text": "Olá! Sua encomenda chegou."
}`} />

                                <h3 className="text-lg font-semibold font-mono text-emerald-400 mt-8 mb-3">POST /messages/send-media</h3>
                                <p className="text-white/60 mb-4">Envia uma imagem, vídeo ou documento via URL pública.</p>

                                <CodeBlock code={`{
  "instanceName": "Atendimento",
  "number": "5511999999999",
  "mediaUrl": "https://exemplo.com/fatura.pdf",
  "mediaType": "document", // image, video, document, audio
  "caption": "Segue sua fatura em anexo"
}`} />
                            </div>
                        )}

                        {activeTab === 'webhooks' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold mb-6 text-white">Webhooks</h2>
                                <p className="text-white/70 mb-6">
                                    Configure uma URL em <strong>Configurações</strong> para receber eventos de mensagens em tempo real.
                                </p>

                                <h3 className="text-lg font-semibold mb-3 text-white/90">Evento: Mensagem Recebida</h3>
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
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiDocsView;
