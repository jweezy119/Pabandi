import { useState, useEffect } from 'react';
import { FiBriefcase, FiUsers, FiTrendingUp, FiAlertTriangle, FiStar, FiZap, FiEye, FiCheckCircle, FiX, FiClock, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';

// ─── API Helper ───────────────────────────────────────────────────────────────

const API = '/api/v1/crm';
const token = localStorage.getItem('token') || '';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CrmClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  totalJobs: number;
  totalSpent: number;
  stage: string;
  reliabilityScore: number;
  lastJobAt?: string;
  createdAt: string;
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'opportunity';
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--soft-stone)]/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm shadow-[var(--shadow-lift)] ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  const v: Record<string, string> = {
    default: 'bg-[var(--soft-stone)] text-[var(--warm-ink)]',
    blue: 'bg-blue-500/20 text-blue-300',
    green: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    red: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]',
    yellow: 'bg-yellow-500/20 text-yellow-300',
    purple: 'bg-[var(--dusty-rose)]/20 text-purple-300',
    gray: 'bg-gray-500/20 text-[var(--soft-stone)]',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v[variant] || v.default}`}>{children}</span>;
}

// ─── Pipeline Kanban ─────────────────────────────────────────────────────────

function PipelineKanban({ clients, onStageChange }: { clients: CrmClient[]; onStageChange: () => void }) {
  const stages = [
    { id: 'lead', label: 'Lead', color: 'blue' },
    { id: 'verified', label: 'Verified', color: 'purple' },
    { id: 'booked', label: 'Booked', color: 'yellow' },
    { id: 'repeat', label: 'Repeat', color: 'green' },
    { id: 'at_risk', label: 'At Risk', color: 'red' },
    { id: 'vip', label: 'VIP', color: 'purple' },
  ];

  const [draggedClient, setDraggedClient] = useState<string | null>(null);

  function getClientsForStage(stageId: string) {
    return clients.filter(c => c.stage === stageId);
  }

  async function handleDrop(stageId: string) {
    if (!draggedClient) return;
    try {
      await api(`/clients/${draggedClient}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: stageId }),
      });
      onStageChange();
    } catch (err: any) {
      alert(err.message);
    }
    setDraggedClient(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stages.map(stage => {
        const stageClients = getClientsForStage(stage.id);
        return (
          <div
            key={stage.id}
            className="bg-[var(--cream)] rounded-xl p-3 min-h-[200px] border border-[var(--soft-stone)]/30"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(stage.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--warm-ink)]">{stage.label}</h4>
              <span className="text-xs text-[var(--soft-stone)] bg-[var(--warm-sand)] px-2 py-0.5 rounded-full">{stageClients.length}</span>
            </div>
            <div className="space-y-2">
              {stageClients.map(client => (
                <div
                  key={client.id}
                  className="p-3 rounded-lg bg-[var(--warm-sand)] border border-[var(--soft-stone)]/30 cursor-grab active:cursor-grabbing hover:border-white/20 transition-all"
                  draggable
                  onDragStart={() => setDraggedClient(client.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-[var(--dusty-rose)] flex items-center justify-center text-[10px] text-[var(--warm-ink)] font-bold">
                      {client.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[var(--warm-ink)] truncate">{client.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={client.reliabilityScore >= 80 ? 'green' : client.reliabilityScore >= 50 ? 'yellow' : 'red'}>
                      {client.reliabilityScore}/100
                    </Badge>
                    <span className="text-xs text-[var(--soft-stone)]">{client.totalJobs} jobs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alerts Feed ──────────────────────────────────────────────────────────────

function AlertsFeed({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: () => void }) {
  const typeConfig: Record<string, { icon: any; color: string }> = {
    critical: { icon: FiAlertTriangle, color: 'red' },
    warning: { icon: FiClock, color: 'yellow' },
    opportunity: { icon: FiZap, color: 'green' },
    info: { icon: FiEye, color: 'blue' },
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[var(--warm-ink)]">Revenue Alerts</h3>
        <Badge variant="yellow">{alerts.filter(a => !a.dismissed).length} active</Badge>
      </div>
      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <FiCheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-[var(--soft-stone)]">All clear. No alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.filter(a => !a.dismissed).slice(0, 10).map(alert => {
            const config = typeConfig[alert.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg bg-${config.color}-500/10 border border-${config.color}-500/20`}>
                <Icon className={`w-5 h-5 mt-0.5 text-${config.color}-400`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--warm-ink)]">{alert.title}</p>
                  <p className="text-xs text-[var(--soft-stone)] mt-0.5">{alert.message}</p>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-1 rounded hover:bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Main PipelineOS Dashboard ────────────────────────────────────────────────

export default function PipelineOSDashboard() {
  const [clients, setClients] = useState<CrmClient[]>( null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'kanban' | 'clients' | 'alerts'>('kanban');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [clientsRes, alertsRes] = await Promise.all([
        api('/clients'),
        api('/alerts'),
      ]);
      setClients(clientsRes.data);
      setAlerts(alertsRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDismissAlert(alertId: string) {
    try {
      await api(`/alerts/${alertId}/dismiss`, { method: 'POST' });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, dismissed: true } : a));
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--soft-stone)] text-sm">Loading PipelineOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-[var(--warm-ink)]">
      {/* Header */}
      <header className="border-b border-[var(--soft-stone)]/30 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <FiBriefcase className="w-5 h-5 text-[var(--warm-ink)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold">PipelineOS</h1>
              <p className="text-xs text-[var(--soft-stone)]">Trust-Aware Revenue Engine</p>
            </div>
          </div>
          <Badge variant="green">Live</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--terracotta)]/10 border border-red-500/30 text-[var(--terracotta)] text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">Total Clients</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{clients.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg">
                <FiUsers className="w-5 h-5 text-[var(--warm-ink)]" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">VIP</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{clients.filter(c => c.stage === 'vip').length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 shadow-lg">
                <FiStar className="w-5 h-5 text-[var(--warm-ink)]" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">At Risk</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{clients.filter(c => c.stage === 'at_risk').length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-[var(--dusty-rose)] shadow-lg">
                <FiAlertTriangle className="w-5 h-5 text-[var(--warm-ink)]" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">Avg Score</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">
                  {clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.reliabilityScore, 0) / clients.length) : 0}/100
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--sage)] to-teal-400 shadow-lg">
                <FiTrendingUp className="w-5 h-5 text-[var(--warm-ink)]" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-xl p-1 border border-[var(--soft-stone)]/30">
          {(['kanban', 'clients', 'alerts'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all capitalize cursor-pointer ${
                activeTab === t ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--warm-ink)] shadow-lg' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--cream)]'
              }`}
            >
              {t === 'kanban' ? 'Pipeline Kanban' : t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            <PipelineKanban clients={clients} onStageChange={loadAll} />
            <AlertsFeed alerts={alerts} onDismiss={handleDismissAlert} />
          </div>
        )}
        {activeTab === 'alerts' && (
          <AlertsFeed alerts={alerts} onDismiss={handleDismissAlert} />
        )}
        {activeTab === 'clients' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Client Directory</h2>
            <div className="space-y-3">
              {clients.map(client => (
                <div key={client.id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm">
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--warm-ink)]">{client.name}</p>
                    <div className="flex items-center gap-3 text-sm text-[var(--soft-stone)]">
                      {client.phone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{client.phone}</span>}
                      {client.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{client.email}</span>}
                      {client.address && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{client.address}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={client.reliabilityScore >= 80 ? 'green' : client.reliabilityScore >= 50 ? 'yellow' : 'red'}>
                      {client.reliabilityScore}/100
                    </Badge>
                    <p className="text-xs text-[var(--soft-stone)] mt-1">{client.stage} · {client.totalJobs} jobs</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
