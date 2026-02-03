
import React, { useState } from 'react';
import StatCard from './StatCard';
import InstanceCard from './InstanceCard';
import { Instance, InstanceStatus } from '../types';

const InstanceView: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectingInstance, setConnectingInstance] = useState<string>('');

  const fetchInstances = () => {
    setLoading(true);
    fetch('/api/instances', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('myzap_token')}` }
    })
      .then(res => res.json())
      .then(data => {
        // Map backend data to Instance type
        const mapped = Array.isArray(data) ? data.map((d: any) => ({
          id: d.id,
          name: d.business_name || d.phone_number || `Instância ${d.id}`,
          status: d.code_verification_status === 'VERIFIED' ? InstanceStatus.CONNECTED : InstanceStatus.DISCONNECTED,
          battery: 100,
          phone: d.phone_number,
          batteryLevel: null
        })) : [];
        setInstances(mapped);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  React.useEffect(() => {
    fetchInstances();
  }, []);

  const handleCreateInstance = async () => {
    if (!newInstanceName) return;
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
        fetchInstances(); // Refresh list

        // Se a API já retornar o QR Code na criação (comum na Evolution)
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
    }
  };

  const handleDelete = async (instance: Instance) => {
    if (!confirm(`Tem certeza que deseja excluir "${instance.name}"?`)) return;
    try {
      await fetch(`/api/instances/${instance.name}`, { // Usando name como ID conforme API server.js
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
      } else {
        // Se não vier base64, talvez já esteja conectado ou retornou apenas status
        if (data.instance && data.instance.status === 'open') {
          alert('Instância já está conectada!');
          setShowQrModal(false);
          fetchInstances();
        } else {
          alert('Não foi possível obter o QR Code. Tente novamente.');
        }
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
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom duration-700 relative">

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
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={!newInstanceName}
                className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
              >
                Criar
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

      {/* High-Level Summaries */}
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

      {/* Main Instance Dashboard */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black dark:text-white flex items-center gap-3">
            <span className="w-1.5 h-8 bg-primary rounded-full"></span>
            Suas Conexões
          </h2>
          <div className="flex gap-2">
            <button
              onClick={fetchInstances}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card-dark rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm hover:text-primary transition-colors"
            >
              <span className={`material-icons-round text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Atualizar
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-24 md:pb-12">
          {instances.map(instance => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onDelete={handleDelete}
              onConnect={handleConnect}
            />
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-huge p-8 flex flex-col items-center justify-center gap-5 group hover:border-primary hover:bg-primary/5 transition-all duration-500 min-h-[320px] bg-white/30 dark:bg-transparent"
          >
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-md group-hover:rotate-12 active:scale-90">
              <span className="material-icons-round text-4xl">add</span>
            </div>
            <div className="text-center">
              <p className="font-black text-xl dark:text-white group-hover:text-primary transition-colors">Nova Instância</p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Conectar novo WhatsApp</p>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
};

export default InstanceView;
