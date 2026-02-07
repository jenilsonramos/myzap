import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Connection,
    Edge,
    Node,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    MarkerType,
    ReactFlowProvider,
    useReactFlow, // Hook para coordenadas
    BackgroundVariant, // Importando variante de fundo
    MiniMap, // Mapa de navegação
} from '@xyflow/react';
import { useToast } from './ToastContext';
import '@xyflow/react/dist/style.css';

// Nós customizados - Mantendo os estilos Glassmorphism
import TriggerNode from './nodes/TriggerNode';
import MessageNode from './nodes/MessageNode';
import AiAgentNode from './nodes/AiAgentNode';
import ApiNode from './nodes/ApiNode';
import ConditionNode from './nodes/ConditionNode';
import DelayNode from './nodes/DelayNode';
import EndNode from './nodes/EndNode';
import GoogleSheetsNode from './nodes/GoogleSheetsNode';
import HumanHandoffNode from './nodes/HumanHandoffNode';
import QuestionNode from './nodes/QuestionNode';
import InteractiveNode from './nodes/InteractiveNode';
import MediaNode from './nodes/MediaNode';
import ScheduleNode from './nodes/ScheduleNode';
import ActionNode from './nodes/ActionNode';
import AbSplitNode from './nodes/AbSplitNode';
import ValidatorNode from './nodes/ValidatorNode';
import SetVariableNode from './nodes/SetVariableNode';
import NoteNode from './nodes/NoteNode';
import SwitchNode from './nodes/SwitchNode';
import DeletableEdge from './DeletableEdge';

const nodeTypes = {
    trigger: TriggerNode,
    message: MessageNode,
    ai_agent: AiAgentNode,
    api: ApiNode,
    condition: ConditionNode,
    delay: DelayNode,
    end: EndNode,
    google_sheets: GoogleSheetsNode,
    handoff: HumanHandoffNode,
    question: QuestionNode,
    interactive: InteractiveNode,
    media: MediaNode,
    schedule: ScheduleNode,
    action: ActionNode,
    ab_split: AbSplitNode,
    validator: ValidatorNode,
    set_variable: SetVariableNode,
    note: NoteNode,
    switch: SwitchNode,
};

const edgeTypes = {
    deletable: DeletableEdge,
};

interface FlowbuilderViewProps {
    flowId: string | null;
    onClose: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const FlowbuilderView: React.FC<FlowbuilderViewProps> = ({ flowId, onClose, isDarkMode, toggleTheme }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [flowName, setFlowName] = useState('Fluxo sem nome');
    const [isUploading, setIsUploading] = useState(false);

    // Refs para o scroll do Dock
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Hook do React Flow para converter coordenadas de tela para fluxo
    const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
    const { showToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);

    // Carregar Fluxo do Banco de Dados
    useEffect(() => {
        const fetchFlowData = async () => {
            if (!flowId) return;
            setIsLoading(true);
            try {
                const response = await fetch(`/api/flows/${flowId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setFlowName(data.name);

                    if (data.content) {
                        const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                        setNodes(content.nodes || []);
                        setEdges(content.edges || []);

                        // Restaurar Viewport (Zoom e Posição) salvo
                        if (content.viewport) {
                            setTimeout(() => {
                                setViewport(content.viewport);
                            }, 50);
                        }
                    }
                } else {
                    showToast('Erro ao carregar dados do fluxo.', 'error');
                }
            } catch (err) {
                showToast('Falha na conexão ao carregar fluxo.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchFlowData();
    }, [flowId, setViewport]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge({
            ...params,
            type: 'deletable',
            animated: true,
            style: { strokeWidth: 3, stroke: '#6366f1' },
            // Removido markerEnd para linha limpa
        }, eds)),
        []
    );

    const onSave = async () => {
        const flowData = {
            nodes,
            edges,
            viewport: getViewport()
        };

        try {
            const response = await fetch(`/api/flows/${flowId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: JSON.stringify({
                    name: flowName,
                    content: flowData,
                    status: 'active' // Mantemos como ativo ao salvar, ou deixamos o estado atual
                })
            });

            if (response.ok) {
                showToast('Fluxo salvo no banco de dados!', 'success');
            } else {
                showToast('Erro ao salvar no servidor.', 'error');
            }
        } catch (err) {
            showToast('Erro de conexão ao salvar.', 'error');
        }
    };

    const addNode = (type: string) => {
        // Impedir múltiplos nós de Trigger
        if (type === 'trigger') {
            const hasTrigger = nodes.some(n => n.type === 'trigger');
            if (hasTrigger) {
                showToast('Apenas um nó de início é permitido por fluxo.', 'warning');
                return;
            }
        }

        // Obter o centro da visualização atual
        const center = screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
        });

        // Lógica de Anti-Colisão
        let finalPosition = { ...center };
        let overlap = true;
        let attempts = 0;
        const spacing = 50; // Pixels de deslocamento por tentativa

        while (overlap && attempts < 100) {
            // Verifica se algum nó existente está muito próximo da posição proposta
            const isOverlapping = nodes.some(n =>
                Math.abs(n.position.x - finalPosition.x) < 250 && // Largura aprox do nó + margem
                Math.abs(n.position.y - finalPosition.y) < 150    // Altura aprox do nó + margem
            );

            if (isOverlapping) {
                // Se colidir, desloca um pouco para baixo e direita
                finalPosition.x += spacing;
                finalPosition.y += spacing;
                attempts++;
            } else {
                overlap = false;
            }
        }

        const newNode: Node = {
            id: `${type}_${Date.now()}`,
            type,
            position: finalPosition,
            data: { label: `Novo nó ${type}`, ...getDefaultData(type) },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const scrollDock = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300;
            scrollContainerRef.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const getDefaultData = (type: string) => {
        switch (type) {
            case 'message': return { message: 'Olá! Como posso ajudar?' };
            case 'ai_agent': return { model: 'gemini-1.5-pro', prompt: 'Você é um assistente útil.' };
            case 'api': return { method: 'POST', url: '', headers: [], body: '{}' };
            case 'delay': return { delay: 5 };
            case 'condition': return { rule: '' };
            case 'google_sheets': return { spreadsheetId: '', range: '', operation: 'read' };
            case 'media': return { url: '', mediaType: 'image', caption: '' };
            case 'handoff': return { department: 'suporte', message: 'Transferindo para um atendente...' };
            case 'schedule': return { time: '09:00', days: ['seg', 'ter', 'qua', 'qui', 'sex'] };
            case 'ab_split': return { variantA: 50, variantB: 50 };
            case 'question': return { question: 'Digite sua resposta:', variable: 'user_input' };
            case 'validator': return { validationType: 'email', errorMessage: 'Formato inválido!' };
            case 'action': return { actionType: 'add_tag', tag: '' };
            case 'set_variable': return { variableName: '', value: '' };
            case 'switch': return { variable: '', cases: ['Opção 1', 'Opção 2', 'Default'] };
            case 'note': return { text: 'Nota Importante...', color: '#fff7ed' };
            default: return {};
        }
    };

    const onNodeClick = (_: any, node: Node) => {
        setSelectedNode(node);
    };

    const handleFileUpload = async (file: File) => {
        if (!selectedNode) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/flows/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();

                // Identify mediaType from mime
                let mediaType = 'document';
                if (file.type.startsWith('image/')) mediaType = 'image';
                else if (file.type.startsWith('video/')) mediaType = 'video';
                else if (file.type.startsWith('audio/')) mediaType = 'audio';

                // Update node data using onUpdate logic
                const updatedData = {
                    ...selectedNode.data,
                    url: data.url,
                    mediaType: mediaType,
                    messageType: 'media'
                };

                setNodes((nds) =>
                    nds.map((node) => {
                        if (node.id === selectedNode.id) {
                            return { ...node, data: updatedData };
                        }
                        return node;
                    })
                );

                // Also update local selectedNode to reflect changes in Panel
                setSelectedNode({ ...selectedNode, data: updatedData });

                showToast('Arquivo enviado com sucesso!', 'success');
            } else {
                showToast('Erro ao fazer upload do arquivo.', 'error');
            }
        } catch (err) {
            showToast('Falha na conexão ao subir arquivo.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const updateNodeData = (newData: any) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...newData } } : n))
        );
        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...newData } });
    };

    const duplicateNode = () => {
        if (!selectedNode) return;

        const newPosition = {
            x: selectedNode.position.x + 50,
            y: selectedNode.position.y + 50
        };

        const newNode: Node = {
            ...selectedNode,
            id: `${selectedNode.type}_${Date.now()}`,
            position: newPosition,
            data: { ...selectedNode.data, label: `${selectedNode.data.label} (Cópia)` },
            selected: false,
        };

        setNodes((nds) => nds.concat(newNode));

        // Opcional: Selecionar o novo nó automaticamente
        setSelectedNode(newNode);
        showToast('Nó duplicado com sucesso!', 'success');
    };

    // Atalhos de Teclado (Hotkeys)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignorar se estiver digitando em input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;

            // Salvar: Ctrl + S / Cmd + S
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                onSave();
                return;
            }

            // Duplicar: Ctrl + D / Cmd + D
            if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
                event.preventDefault();
                duplicateNode();
                return;
            }

            // Excluir: Delete / Backspace
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (selectedNode) {
                    if (selectedNode.type === 'trigger') {
                        showToast('O nó de início não pode ser excluído.', 'warning');
                        return;
                    }
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                    setSelectedNode(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, edges, selectedNode, onSave, duplicateNode]);

    return (
        <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex overflow-hidden">

            {/* Top Center: Unified Floating Dock (True All-in-One) */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-auto max-w-[95vw]">

                {/* Custom Style for hiding scrollbar */}
                <style>{`
                    .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }
                    .scrollbar-hide {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}</style>

                {/* Main Glass Container */}
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-3xl px-3 py-2.5 rounded-[2.5rem] border border-white/40 dark:border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] flex items-center gap-3 ring-1 ring-white/50 dark:ring-white/10 transition-all hover:bg-white/70 dark:hover:bg-black/50 hover:scale-[1.01] hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.4)]">

                    {/* Navigation Group (Integrated) */}
                    <div className="flex items-center gap-3 pr-2 shrink-0">
                        <button
                            onClick={onClose}
                            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all shadow-sm"
                            title="Voltar"
                        >
                            <span className="material-icons-round text-xl">arrow_back</span>
                        </button>
                        <div className="h-10 px-4 rounded-xl bg-white/30 dark:bg-white/5 border border-white/10 flex items-center justify-center">
                            <h1 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide whitespace-nowrap">{flowName}</h1>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent mx-1 shrink-0"></div>

                    {/* Navigation Left */}
                    <button onClick={() => scrollDock('left')} className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition-all shrink-0">
                        <span className="material-icons-round text-xl">chevron_left</span>
                    </button>

                    {/* Tools Horizontal Scroll */}
                    <div ref={scrollContainerRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full max-w-[50vw] px-1 py-1 scroll-smooth">
                        <ToolButton icon="play_arrow" label="Gatilho" color="emerald-500" onClick={() => addNode('trigger')} />
                        <ToolButton icon="chat" label="Mensagem" color="blue-500" onClick={() => addNode('message')} />
                        <ToolButton icon="timer" label="Delay" color="slate-500" onClick={() => addNode('delay')} />
                        <ToolButton icon="call_merge" label="Condição" color="amber-500" onClick={() => addNode('condition')} />
                        <ToolButton icon="help_outline" label="Pergunta" color="orange-500" onClick={() => addNode('question')} />

                        <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent mx-1 shrink-0"></div>

                        <ToolButton icon="psychology" label="IA Agent" color="purple-600" onClick={() => addNode('ai_agent')} />
                        <ToolButton icon="hub" label="API" color="violet-500" onClick={() => addNode('api')} />
                        <ToolButton icon="table_chart" label="Sheets" color="green-600" onClick={() => addNode('google_sheets')} />

                        <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent mx-1 shrink-0"></div>

                        <ToolButton icon="schedule" label="Horário" color="rose-500" onClick={() => addNode('schedule')} />
                        <ToolButton icon="rule" label="Validador" color="emerald-600" onClick={() => addNode('validator')} />
                        <ToolButton icon="alt_route" label="A/B Split" color="indigo-600" onClick={() => addNode('ab_split')} />
                        <ToolButton icon="call_split" label="Switch" color="pink-500" onClick={() => addNode('switch')} />

                        <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent mx-1 shrink-0"></div>

                        <ToolButton icon="edit_note" label="Nota" color="yellow-500" onClick={() => addNode('note')} />
                        <ToolButton icon="data_object" label="Variável" color="teal-500" onClick={() => addNode('set_variable')} />

                        <ToolButton icon="support_agent" label="Transf." color="cyan-500" onClick={() => addNode('handoff')} />
                        <ToolButton icon="smart_toy" label="Ação" color="blue-500" onClick={() => addNode('action')} />
                        <ToolButton icon="stop_circle" label="Fim" color="rose-600" onClick={() => addNode('end')} />
                    </div>

                    {/* Navigation Right */}
                    <button onClick={() => scrollDock('right')} className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition-all shrink-0">
                        <span className="material-icons-round text-xl">chevron_right</span>
                    </button>

                    {/* Divider Separator */}
                    <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent mx-1 shrink-0"></div>

                    {/* Actions Group (Uniform Sizes) */}
                    <div className="flex items-center gap-2 pl-1 shrink-0">
                        <button
                            onClick={toggleTheme}
                            className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full hover:bg-white/50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-all group shrink-0 relative overflow-hidden"
                            title="Alternar Tema"
                        >
                            <span className="material-icons-round text-[24px] mb-0.5 group-hover:-translate-y-0.5 transition-transform duration-300">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100 group-hover:translate-y-0.5 transition-all">Tema</span>
                        </button>

                        <button
                            onClick={onSave}
                            className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full bg-indigo-500/90 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all group shrink-0 relative overflow-hidden border border-white/10"
                            title="Salvar Fluxo"
                        >
                            <span id="save-icon" className="material-icons-round text-[24px] mb-0.5 group-hover:-translate-y-0.5 transition-transform duration-300">save</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest group-hover:translate-y-0.5 transition-all">Salvar</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* Canvas Principal */}
            <div className="flex-1 w-full h-full relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={() => setSelectedNode(null)}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    className="touch-none"
                    minZoom={0.1}
                    maxZoom={2}
                    style={{
                        background: isDarkMode
                            ? 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)'
                            : 'radial-gradient(circle at 50% 50%, #f8fafc 0%, #e2e8f0 100%)'
                    }}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        color={isDarkMode ? '#64748b' : '#94a3b8'}
                        gap={20}
                        size={1.5}
                        className={isDarkMode ? 'opacity-20' : 'opacity-40'}
                    />
                    <Controls className="!bg-white/80 dark:!bg-black/50 !backdrop-blur-xl !border-white/20 dark:!border-white/10 !shadow-2xl !rounded-2xl !m-6" />
                    <MiniMap
                        nodeStrokeColor={(n) => {
                            if (n.type === 'trigger') return '#10b981';
                            if (n.type === 'end') return '#f43f5e';
                            if (n.type === 'condition') return '#f59e0b';
                            if (selectedNode?.id === n.id) return '#6366f1';
                            return isDarkMode ? '#e2e8f0' : '#1e293b';
                        }}
                        nodeColor={(n) => {
                            if (selectedNode?.id === n.id) return isDarkMode ? '#4f46e5' : '#818cf8';
                            return isDarkMode ? '#1e293b' : '#fff';
                        }}
                        maskColor={isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)'}
                        className="!bg-white/80 dark:!bg-black/50 !backdrop-blur-xl !border-white/20 dark:!border-white/10 !shadow-2xl !rounded-2xl !m-6 !w-48 !h-32"
                    />
                </ReactFlow>
            </div>

            {/* Right: Properties Sidebar (Overlay) */}
            {selectedNode && (
                <PropertiesPanel
                    node={selectedNode}
                    isUploading={isUploading}
                    onUpload={handleFileUpload}
                    onUpdate={updateNodeData}
                    onClose={() => setSelectedNode(null)}
                    onDelete={() => {
                        if (selectedNode.type === 'trigger') {
                            showToast('O nó de início não pode ser excluído.', 'warning');
                            return;
                        }
                        setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                        setSelectedNode(null);
                    }}
                    onDuplicate={duplicateNode}
                />
            )}
        </div>
    );
};

// Componentes Auxiliares
const ToolButton = ({ icon, label, color, onClick }: any) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center justify-center w-[70px] h-[70px] group rounded-2xl transition-all hover:bg-white/40 dark:hover:bg-white/5 shrink-0 relative"
    >
        <div className={`w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-white/10 flex items-center justify-center text-${color} shadow-sm group-hover:-translate-y-1.5 group-hover:scale-110 group-hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.15)] group-hover:border-${color}/30 transition-all duration-300 relative z-10 box-border`}>
            <div className={`absolute inset-0 bg-${color}/0 group-hover:bg-${color}/10 transition-colors rounded-xl`}></div>
            <span className="material-icons-round text-[24px] relative z-20">{icon}</span>
        </div>
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-all group-hover:translate-y-0.5 opacity-80 group-hover:opacity-100">{label}</span>

        {/* Glow effect on hover */}
        <div className={`absolute inset-0 rounded-2xl bg-${color}/0 group-hover:bg-${color}/5 blur-md transition-all duration-300 -z-0`}></div>
    </button>
);

// Dicionário de Ajuda Contextual
const helpContent: any = {
    api: {
        title: 'Como configurar API',
        description: 'Faça requisições HTTP para sistemas externos.',
        example: `{
  "method": "POST",
  "url": "https://api.seusistema.com/v1/pedidos",
  "body": {
    "cliente": "{{contact.name}}",
    "telefone": "{{contact.phone}}"
  }
}`
    },
    google_sheets: {
        title: 'Integração Google Sheets',
        description: 'Leia ou grave linhas em uma planilha. A planilha deve estar pública ou compartilhada com o bot.',
        example: 'Range: "Página1!A:C"\nOperação: "Escrever"\nDados: ["{{contact.name}}", "{{contact.phone}}", "Novo Lead"]'
    },
    condition: {
        title: 'Lógica Condicional',
        description: 'Direcione o fluxo com base em variáveis ou respostas anteriores.',
        example: 'variable_name == "sim"\nuser_age >= 18\ncontact.tags contains "vip"'
    },
    ai_agent: {
        title: 'Agente de IA (Gemini/GPT)',
        description: 'Defina a personalidade e o conhecimento do seu assistente.',
        example: 'Prompt: "Você é um atendente de pizzaria. O menu é: Pizza A ($10), Pizza B ($12). Responda educadamente e tente fechar o pedido."'
    },
    interactive: {
        title: 'Mensagens Interativas',
        description: 'Envie botões ou listas para facilitar a resposta do usuário (WhatsApp Oficial).',
        example: 'Tipo: Lista\nOpções: "Ver Menu, Falar com Suporte, Promoções"\nCorpo: "Escolha uma opção abaixo:"'
    },
    validator: {
        title: 'Validação de Dados',
        description: 'Garanta que o usuário digitou o formato correto antes de prosseguir.',
        example: 'Tipo: CPF\nErro: "CPF inválido! Por favor digite apenas números."'
    },
    set_variable: {
        title: 'Definir Variável',
        description: 'Salve informações no perfil do contato para usar depois.',
        example: 'Nome: categoria_cliente\nValor: "VIP"'
    },
    switch: {
        title: 'Switch / Condicional Múltiplo',
        description: 'Crie vários caminhos baseados no valor de uma variável.',
        example: 'Variável: "opcao_menu"\nCasos: "Vendas", "Suporte", "Financeiro"'
    }
};

const HelpAlert = ({ type }: { type: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const content = helpContent[type];

    if (!content) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors mb-2"
            >
                <span className="material-icons-round text-sm">{isOpen ? 'expand_less' : 'help_outline'}</span>
                {isOpen ? 'Ocultar Ajuda' : 'Ver Exemplo de Uso'}
            </button>

            {isOpen && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">{content.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">{content.description}</p>
                    <div className="bg-white dark:bg-black/50 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900/30">
                        <code className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap block">
                            {content.example}
                        </code>
                    </div>
                </div>
            )}
        </div>
    );
};

const PropertiesPanel = ({ node, onUpdate, onClose, onDelete, onDuplicate, onUpload, isUploading }: {
    node: Node,
    onUpdate: (data: any) => void,
    onClose: () => void,
    onDelete: () => void,
    onDuplicate: () => void,
    onUpload: (file: File) => void,
    isUploading: boolean
}) => {
    // Glassmorphism Styles
    const glassPanel = "bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl";
    const glassInput = "w-full bg-white/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-400";
    const glassSelect = "w-full bg-white/50 dark:bg-black/20 border border-slate-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all";
    const labelStyle = "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block";

    return (
        <div className={`absolute right-6 top-24 w-96 rounded-[32px] z-50 flex flex-col max-h-[80vh] animate-slide-in-right ${glassPanel}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100/50 dark:border-white/5">
                <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Editar Nó</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${node.selected ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'}`}></span>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {node.type.toUpperCase()}</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors group">
                    <span className="material-icons-round text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 text-lg transition-colors">close</span>
                </button>
            </div>

            {/* Content Scrollable */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                {renderForm()}
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-100/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] rounded-b-[32px] flex gap-3">
                <button
                    onClick={onDuplicate}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-200/50 dark:border-indigo-500/20 shadow-sm"
                >
                    <span className="material-icons-round text-lg">content_copy</span>
                    Duplicar
                </button>
                <button
                    onClick={onDelete}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 font-bold text-xs uppercase hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all border border-rose-200/50 dark:border-rose-500/20 shadow-sm"
                >
                    <span className="material-icons-round text-lg">delete_outline</span>
                    Excluir
                </button>
            </div>
        </div>
    );

    function renderForm() {
        switch (node.type) {
            case 'message':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className={labelStyle}>Tipo de Mensagem</label>
                            <select
                                className={glassSelect}
                                value={node.data.messageType || 'text'}
                                onChange={(e) => onUpdate({ messageType: e.target.value })}
                            >
                                <option value="text">Texto</option>
                                <option value="media">Arquivo / Mídia</option>
                            </select>
                        </div>

                        {(!node.data.messageType || node.data.messageType === 'text') && (
                            <div className="animate-in slide-in-from-top-2">
                                <label className={labelStyle}>Conteúdo do Texto</label>
                                <textarea
                                    className={`${glassInput} h-32 resize-none leading-relaxed`}
                                    value={node.data.message || ''}
                                    onChange={(e) => onUpdate({ message: e.target.value })}
                                    placeholder="Digite sua mensagem de texto..."
                                />
                            </div>
                        )}

                        {node.data.messageType === 'media' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className={labelStyle}>Arquivo do Dispositivo</label>
                                    <div className="relative group/upload">
                                        <input
                                            type="file"
                                            id="flow-file-upload"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) onUpload(file);
                                            }}
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="flow-file-upload"
                                            className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${isUploading
                                                ? 'bg-slate-50 border-slate-200 cursor-wait'
                                                : 'bg-indigo-50/30 border-indigo-200/50 hover:bg-indigo-50 hover:border-indigo-400 group-hover/upload:shadow-md'
                                                }`}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-xs font-bold text-indigo-600 uppercase">Subindo...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-icons-round text-indigo-500">cloud_upload</span>
                                                    <div className="text-left">
                                                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-tight">Escolher Arquivo</p>
                                                        <p className="text-[10px] text-indigo-400">PDF, Imagem, Vídeo ou Áudio</p>
                                                    </div>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                <div className="relative py-2 flex items-center">
                                    <div className="flex-grow border-t border-slate-100 dark:border-white/5"></div>
                                    <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">ou use um link</span>
                                    <div className="flex-grow border-t border-slate-100 dark:border-white/5"></div>
                                </div>

                                <div>
                                    <label className={labelStyle}>URL do Arquivo</label>
                                    <textarea
                                        className={`${glassInput} h-20 font-mono text-[10px] leading-tight`}
                                        value={node.data.url || ''}
                                        onChange={(e) => onUpdate({ url: e.target.value })}
                                        placeholder="https://sua-url.com/arquivo.jpg"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelStyle}>Tipo de Mídia</label>
                                        <select className={glassSelect} value={node.data.mediaType || 'image'} onChange={(e) => onUpdate({ mediaType: e.target.value })}>
                                            <option value="image">Imagem</option>
                                            <option value="video">Vídeo</option>
                                            <option value="audio">Áudio</option>
                                            <option value="document">Documento</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Legenda (Opcional)</label>
                                        <input
                                            className={glassInput}
                                            value={node.data.caption || ''}
                                            onChange={(e) => onUpdate({ caption: e.target.value })}
                                            placeholder="Descrição..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'ai_agent':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="ai_agent" />
                        <div>
                            <label className={labelStyle}>Modelo de IA</label>
                            <div className="relative">
                                <select
                                    className={`${glassSelect} appearance-none cursor-pointer`}
                                    value={node.data.model}
                                    onChange={(e) => onUpdate({ model: e.target.value })}
                                >
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="gpt-4o">GPT-4o (OpenAI)</option>
                                </select>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 pointer-events-none text-sm">expand_more</span>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>System Prompt</label>
                            <textarea
                                className={`${glassInput} h-40 resize-none font-mono text-xs`}
                                value={node.data.prompt || ''}
                                onChange={(e) => onUpdate({ prompt: e.target.value })}
                                placeholder="Você é um assistente útil..."
                            />
                        </div>
                    </div>
                );
            case 'trigger':
                return (
                    <div className="space-y-5">
                        <div>
                            <label className={labelStyle}>Tipo de Gatilho</label>
                            <select
                                className={glassSelect}
                                value={node.data.type || 'keyword'}
                                onChange={(e) => onUpdate({ type: e.target.value })}
                            >
                                <option value="keyword">Palavra-Chave</option>
                                <option value="all">Qualquer Mensagem</option>
                            </select>
                        </div>

                        {node.data.type === 'keyword' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className={labelStyle}>Tipo de Correspondência</label>
                                    <select
                                        className={glassSelect}
                                        value={node.data.matchType || 'contains'}
                                        onChange={(e) => onUpdate({ matchType: e.target.value })}
                                    >
                                        <option value="contains">Contém</option>
                                        <option value="starts">Começa com</option>
                                        <option value="ends">Termina com</option>
                                        <option value="exact">Exato</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelStyle}>Palavras-Chave (separadas por vírgula)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-slate-400 font-bold">#</span>
                                        <textarea
                                            className={`${glassInput} pl-8 font-bold h-24 resize-none`}
                                            placeholder="oi, olá, bom dia, promoção"
                                            value={node.data.keyword || ''}
                                            onChange={(e) => onUpdate({ keyword: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Use vírgulas para múltiplas palavras</p>
                                </div>
                            </div>
                        )}

                        {node.data.type === 'all' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="material-icons-round text-amber-500 text-lg">schedule</span>
                                        <div>
                                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">Cooldown de Repetição</p>
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                                                Evita que o mesmo contato dispare o fluxo repetidamente dentro do período definido.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelStyle}>Repetir após (horas)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className={`${glassInput} pr-12 font-mono text-lg font-bold`}
                                            value={node.data.cooldownHours ?? 6}
                                            onChange={(e) => onUpdate({ cooldownHours: parseInt(e.target.value) || 0 })}
                                            min={0}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Horas</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">0 = sempre dispara</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'delay':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className={labelStyle}>Tempo (Segundos)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className={`${glassInput} pr-12 font-mono text-lg font-bold`}
                                    value={node.data.delay || 0}
                                    onChange={(e) => onUpdate({ delay: parseInt(e.target.value) })}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Seg</span>
                            </div>
                        </div>
                    </div>
                );
            case 'api':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="api" />
                        <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-1">
                                <label className={labelStyle}>Método</label>
                                <select className={`${glassSelect} px-2 font-bold`} value={node.data.method} onChange={(e) => onUpdate({ method: e.target.value })}>
                                    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                                </select>
                            </div>
                            <div className="col-span-3">
                                <label className={labelStyle}>URL Endpoint</label>
                                <input className={`${glassInput} font-mono text-xs`} placeholder="https://api..." value={node.data.url} onChange={(e) => onUpdate({ url: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>JSON Body</label>
                            <textarea className={`${glassInput} font-mono text-xs h-32 leading-relaxed`} value={node.data.body} onChange={(e) => onUpdate({ body: e.target.value })} placeholder="{ 'key': 'value' }" />
                        </div>
                    </div>
                );
            case 'condition':
                return (
                    <div className="space-y-4">
                        <HelpAlert type="condition" />
                        <div>
                            <label className={labelStyle}>Regra Lógica</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-amber-500 text-sm">code</span>
                                <input
                                    className={`${glassInput} pl-10 font-mono text-xs font-medium text-amber-600`}
                                    placeholder="var == 'valor'"
                                    value={node.data.rule || ''}
                                    onChange={(e) => onUpdate({ rule: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'question':
                return (
                    <div className="space-y-5">
                        <div>
                            <label className={labelStyle}>Pergunta ao Usuário</label>
                            <textarea
                                className={`${glassInput} h-24 resize-none`}
                                value={node.data.question || ''}
                                onChange={(e) => onUpdate({ question: e.target.value })}
                                placeholder="Qual seu nome?"
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Salvar Resposta em:</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-bold">@</span>
                                <input
                                    className={`${glassInput} pl-10 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400`}
                                    placeholder="ex: nome_cliente"
                                    value={node.data.variable || ''}
                                    onChange={(e) => onUpdate({ variable: e.target.value })}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                <span className="material-icons-round text-[12px]">info</span>
                                Você pode usar o valor depois com {'{{'}nome_cliente{'}}'}
                            </p>
                        </div>
                    </div>
                );
            case 'google_sheets':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="google_sheets" />
                        <div>
                            <label className={labelStyle}>Spreadsheet ID</label>
                            <input className={`${glassInput} font-mono text-xs text-green-700`} value={node.data.spreadsheetId || ''} onChange={(e) => onUpdate({ spreadsheetId: e.target.value })} placeholder="1BxiMVs0XRA5nFMdKbBdB_..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelStyle}>Operação</label>
                                <select className={glassSelect} value={node.data.operation || 'read'} onChange={(e) => onUpdate({ operation: e.target.value })}>
                                    <option value="read">Ler Linha</option>
                                    <option value="write">Escrever</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelStyle}>Range</label>
                                <input className={glassInput} value={node.data.range || ''} onChange={(e) => onUpdate({ range: e.target.value })} placeholder="Página1!A:C" />
                            </div>
                        </div>
                    </div>
                );
            case 'interactive':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="interactive" />
                        <div>
                            <label className={labelStyle}>Tipo de Interação</label>
                            <select className={glassSelect} value={node.data.interactiveType || 'button'} onChange={(e) => onUpdate({ interactiveType: e.target.value })}>
                                <option value="button">Botões (Quick Reply)</option>
                                <option value="list">Lista de Opções</option>
                                <option value="cta_url">Link Externo</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Texto do Corpo</label>
                            <textarea className={`${glassInput} h-20 resize-none`} value={node.data.body || ''} onChange={(e) => onUpdate({ body: e.target.value })} placeholder="Texto explicativo..." />
                        </div>
                        <div>
                            <label className={labelStyle}>Opções (Separar por vírgula)</label>
                            <input className={glassInput} value={node.data.options || ''} onChange={(e) => onUpdate({ options: e.target.value })} placeholder="Sim, Não, Talvez" />
                        </div>
                    </div>
                );
            case 'validator':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="validator" />
                        <div>
                            <label className={labelStyle}>Tipo</label>
                            <select className={glassSelect} value={node.data.validationType || 'email'} onChange={(e) => onUpdate({ validationType: e.target.value })}>
                                <option value="email">E-mail</option>
                                <option value="cpf">CPF</option>
                                <option value="phone">Telefone</option>
                                <option value="url">URL</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Mensagem de Erro</label>
                            <input className={`${glassInput} text-rose-600`} value={node.data.errorMessage || ''} onChange={(e) => onUpdate({ errorMessage: e.target.value })} placeholder="Inválido, tente novamente." />
                        </div>
                    </div>
                );
            case 'set_variable':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="set_variable" />
                        <div>
                            <label className={labelStyle}>Nome da Variável</label>
                            <input className={`${glassInput} font-mono font-bold text-teal-600`} value={node.data.variableName || ''} onChange={(e) => onUpdate({ variableName: e.target.value })} placeholder="categoria_cliente" />
                        </div>
                        <div>
                            <label className={labelStyle}>Valor a Atribuir</label>
                            <input className={glassInput} value={node.data.value || ''} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="VIP" />
                        </div>
                    </div>
                );
            case 'switch':
                return (
                    <div className="space-y-5">
                        <HelpAlert type="switch" />
                        <div>
                            <label className={labelStyle}>Variável Observada</label>
                            <input className={`${glassInput} font-mono font-bold text-pink-600`} value={node.data.variable || ''} onChange={(e) => onUpdate({ variable: e.target.value })} placeholder="escolha_menu" />
                        </div>
                        <div>
                            <label className={labelStyle}>Casos (Opções)</label>
                            <textarea className={`${glassInput} h-24 resize-none`} value={node.data.cases || ''} onChange={(e) => onUpdate({ cases: e.target.value })} placeholder="Vendas, Suporte, Financeiro" />
                            <p className="text-[9px] text-slate-400 mt-1 pl-1">Separe por vírgulas. Um caminho será criado para cada opção.</p>
                        </div>
                    </div>
                );
            case 'note':
                return (
                    <div className="space-y-4">
                        <label className={labelStyle}>Conteúdo da Nota</label>
                        <textarea className={`${glassInput} bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30 text-slate-700 dark:text-yellow-100 h-40 resize-none font-handwriting text-lg leading-relaxed`} value={node.data.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} />
                        <div className="flex gap-2 justify-center">
                            {['#fff7ed', '#fef2f2', '#f0f9ff', '#f0fdf4', '#fdf4ff'].map(color => (
                                <button
                                    key={color}
                                    className="w-6 h-6 rounded-full border border-black/10 hover:scale-125 transition-transform shadow-sm"
                                    style={{ backgroundColor: color }}
                                    onClick={() => onUpdate({ color })}
                                />
                            ))}
                        </div>
                    </div>
                );
            // Default cases for other nodes (simplified for brevity but using glass styles)
            default:
                return (
                    <div className="space-y-4">
                        {/* Fallback for nodes like 'media', 'handoff', 'schedule', 'ab_split', 'action' - generic inputs */}
                        {['media', 'handoff', 'schedule', 'ab_split', 'action'].includes(node.type) ? renderGenericNodes(node, onUpdate, glassInput, glassSelect, labelStyle) : (
                            <div className="p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-center">
                                <p className="text-xs text-slate-500 mb-2">Configurações deste nó</p>
                                <input className={glassInput} value={node.data.label || ''} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="Rótulo do Nó" />
                            </div>
                        )}
                    </div>
                );
        }
    }

    // Helper for less complex nodes to avoid massive switch
    function renderGenericNodes(node: any, onUpdate: any, glassInput: string, glassSelect: string, labelStyle: string) {
        if (node.type === 'media') return (
            <div className="space-y-4">
                <div>
                    <label className={labelStyle}>Tipo</label>
                    <select className={glassSelect} value={node.data.mediaType || 'image'} onChange={(e) => onUpdate({ mediaType: e.target.value })}>
                        <option value="image">Imagem</option><option value="video">Vídeo</option><option value="audio">Áudio</option><option value="document">Doc</option>
                    </select>
                </div>
                <div>
                    <label className={labelStyle}>URL</label>
                    <textarea className={`${glassInput} h-20`} value={node.data.url || ''} onChange={(e) => onUpdate({ url: e.target.value })} />
                </div>
                <div>
                    <label className={labelStyle}>Legenda</label>
                    <input className={glassInput} value={node.data.caption || ''} onChange={(e) => onUpdate({ caption: e.target.value })} />
                </div>
            </div>
        );
        if (node.type === 'handoff') return (
            <div className="space-y-4">
                <div><label className={labelStyle}>Departamento</label><input className={glassInput} value={node.data.department || ''} onChange={(e) => onUpdate({ department: e.target.value })} /></div>
                <div><label className={labelStyle}>Mensagem</label><textarea className={`${glassInput} h-24`} value={node.data.message || ''} onChange={(e) => onUpdate({ message: e.target.value })} /></div>
            </div>
        );
        if (node.type === 'schedule') return (
            <div className="space-y-4">
                <div><label className={labelStyle}>Horário</label><input type="time" className={glassInput} value={node.data.time || ''} onChange={(e) => onUpdate({ time: e.target.value })} /></div>
                <div>
                    <label className={labelStyle}>Dias</label>
                    <div className="flex flex-wrap gap-2">
                        {['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].map(day => (
                            <button key={day} className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${node.data.days?.includes(day) ? 'bg-indigo-500 text-white shadow-md' : 'bg-white/50 dark:bg-white/10 text-slate-500'}`} onClick={() => {
                                const days = node.data.days || [];
                                onUpdate({ days: days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day] });
                            }}>{day}</button>
                        ))}
                    </div>
                </div>
            </div>
        );
        if (node.type === 'action') return (
            <div className="space-y-4">
                <div><label className={labelStyle}>Ação</label><select className={glassSelect} value={node.data.actionType} onChange={(e) => onUpdate({ actionType: e.target.value })}><option value="add_tag">Add Tag</option><option value="remove_tag">Remove Tag</option></select></div>
                <div><label className={labelStyle}>Tag</label><input className={glassInput} value={node.data.tag || ''} onChange={(e) => onUpdate({ tag: e.target.value })} /></div>
            </div>
        );
        if (node.type === 'ab_split') return (
            <div className="space-y-4">
                <label className={labelStyle}>Distribuição A/B (%)</label>
                <div className="flex gap-4">
                    <div className="flex-1 text-center"><span className="text-xs font-bold text-indigo-500 mb-1 block">A</span><input type="number" className={glassInput} value={node.data.variantA || 50} onChange={(e) => onUpdate({ variantA: parseInt(e.target.value), variantB: 100 - parseInt(e.target.value) })} /></div>
                    <div className="flex-1 text-center"><span className="text-xs font-bold text-purple-500 mb-1 block">B</span><input type="number" className={glassInput} value={node.data.variantB || 50} readOnly /></div>
                </div>
            </div>
        );
        return null;
    }
};

export default (props: any) => (
    <ReactFlowProvider>
        <FlowbuilderView {...props} />
    </ReactFlowProvider>
);
