
import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import { Instance, InstanceStatus } from '../types';

const InstanceView: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectingInstance, setConnectingInstance] = useState<string>('');

  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/instances', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
      });
      const data = await res.json();

      const mapped = Array.isArray(data) ? data.map((d: any) => ({
        id: d.id,
        name: d.business_name || d.phone_number || `Instância ${d.id}`,
        // Verifica se status Evolution (d.status) ou local (d.code_verification_status) indica conexão
        status: (d.status === 'open' || d.code_verification_status === 'VERIFIED' || d.code_verification_status === 'CONNECTED')
          ? InstanceStatus.CONNECTED
          : InstanceStatus.DISCONNECTED,
        battery: 100,
        phone: d.phone_number,
        batteryLevel: null
      })) : [];
      setInstances(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 10000); // Poll list every 10s
    return () => clearInterval(interval);
  }, []);

  // Poll specific instance status when QR modal is open
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (showQrModal && connectingInstance) {
      pollInterval = setInterval(async () => {
        await fetchInstances();
        // Check if our connecting instance became connected
        const instance = instances.find(i => i.name === connectingInstance);
        if (instance && instance.status === InstanceStatus.CONNECTED) {
          setShowQrModal(false);
          alert(`Conectado com sucesso!`);
        }
      }, 3000);
    }
    return () => clearInterval(pollInterval);
  }, [showQrModal, connectingInstance, instances]); // Depend on instances to see update

  const handleCreateInstance = async () => {
    if (!newInstanceName) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('myzap_token')}`
        },
        body: JSON.stringify({ instanceName: newInstanceName })
      });
      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setNewInstanceName('');
        fetchInstances();

        if (data.qrcode && data.qrcode.base64) {
          setQrCodeData(data.qrcode.base64);
          setConnectingInstance(newInstanceName);
          setShowQrModal(true);
        } else if (data.base64) {
          setQrCodeData(data.base64);
          setConnectingInstance(newInstanceName);
          setShowQrModal(true);
        }
      } else {
        alert('Erro ao criar: ' + (data.error || 'Desconhecido'));
      }
    } catch (err) {
      alert('Erro de conexão ao criar instância');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (instance: Instance) => {
    if (!confirm(`Tem certeza que deseja excluir "${instance.name}"?`)) return;
    try {
      await fetch(`/api/instances/${instance.name}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
      });
      fetchInstances();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir');
    }
  };

  const handleConnect = async (instance: Instance) => {
    setConnectingInstance(instance.name);
    setQrCodeData(null);
    setShowQrModal(true);
    try {
      const res = await fetch(`/api/instances/${instance.name}/connect`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
      });
      const data = await res.json();
      if (data.base64 || (data.qrcode && data.qrcode.base64)) {
        setQrCodeData(data.base64 || data.qrcode.base64);
      } else if (data.instance && data.instance.status === 'open') {
        alert('Instância já está conectada!');
        setShowQrModal(false);
        fetchInstances();
      } else {
        alert('Não foi possível obter o QR Code. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar QR Code');
      setShowQrModal(false);
    }
  };

  const total = instances.length;
  const operational = instances.filter(i => i.status === InstanceStatus.CONNECTED).length;
  const critical = instances.filter(i => i.status === InstanceStatus.DISCONNECTED).length;

  return (
    <>
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-card-dark rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black dark:text-white mb-4">Nova Instância</h3>
            <input
              type="text"
              value={newInstanceName}
              onChange={e => setNewInstanceName(e.target.value)}
              placeholder="Nome da instância (ex: atendimento01)"
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 mb-4 focus:ring-2 focus:ring-primary outline-none dark:text-white font-medium"
              disabled={isCreating}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                disabled={isCreating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={!newInstanceName || isCreating}
                className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isCreating && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                {isCreating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-card-dark rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black dark:text-white mb-2 text-center">Conectar {connectingInstance}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6 text-center">Escaneie o QR Code no seu WhatsApp</p>

            <div className="w-64 h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border-4 border-slate-100 dark:border-slate-700">
              {qrCodeData ? (
                <img src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 animate-pulse">
                  <span className="material-icons-round text-4xl text-slate-300">qr_code_scanner</span>
                  <span className="text-xs font-bold text-slate-400">Carregando QR...</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { setShowQrModal(false); fetchInstances(); }}
              className="mt-8 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase tracking-wider text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom duration-700 relative">
        {/* Summaries */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 md:gap-6">
          <StatCard
            label="Instâncias Totais"
            value={total.toString()}
            icon="view_compact"
            colorClass="text-indigo-600 dark:text-indigo-400"
            bgClass="bg-white dark:bg-card-dark shadow-sm"
          />
          <StatCard
            label="Operacionais"
            value={operational.toString()}
            icon="sync_lock"
            colorClass="text-emerald-600 dark:text-emerald-400"
            bgClass="bg-white dark:bg-card-dark shadow-sm"
          />
          <StatCard
            label="Em Pausa"
            value="0"
            icon="pause_circle"
            colorClass="text-amber-600 dark:text-amber-400"
            bgClass="bg-white dark:bg-card-dark shadow-sm"
          />
          <StatCard
            label="Alertas Críticos"
            value={critical.toString()}
            icon="emergency"
            colorClass="text-rose-600 dark:text-rose-400"
            bgClass="bg-white dark:bg-card-dark shadow-sm"
          />
        </section>

        {/* List View */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black dark:text-white flex items-center gap-3">
              <span className="w-1.5 h-8 bg-primary rounded-full"></span>
              Suas Conexões
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-icons-round text-lg">add</span>
                Nova Instância
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <th className="p-4 pl-6 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">Instância</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">Status</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">Número</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">Bateria</th>
                    <th className="p-4 text-right pr-6 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {instances.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-sm font-medium">
                        Nenhuma instância encontrada. Crie uma nova para começar.
                      </td>
                    </tr>
                  ) : null}
                  {instances.map(instance => (
                    <tr key={instance.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${instance.id}`} className="w-full h-full object-cover" alt="Avatar" />
                          </div>
                          <div>
                            <p className="font-bold text-sm dark:text-white">{instance.name}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ID: {instance.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${instance.status === InstanceStatus.CONNECTED
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20'
                          }`}>
                          {instance.status === InstanceStatus.CONNECTED ? 'Conectado' : 'Desconectado'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {instance.phone ? instance.phone.replace('@s.whatsapp.net', '') : '--'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="material-icons-round text-lg text-emerald-500">battery_full</span>
                          <span className="text-xs font-bold">100%</span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {instance.status === InstanceStatus.DISCONNECTED ? (
                            <button
                              onClick={() => handleConnect(instance)}
                              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                              title="Connectar"
                            >
                              <span className="material-icons-round text-lg">qr_code</span>
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDelete(instance)}
                            className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                            title="Excluir"
                          >
                            <span className="material-icons-round text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstanceView;
