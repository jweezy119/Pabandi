import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiTrendingUp, FiAlertTriangle, FiStar, FiZap, FiEye, FiCheckCircle, FiX, FiClock, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import { Card, EmptyState, ClayBadge } from '../../components/primitives';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingState from './components/LoadingState';
import { getAuthToken } from '../../utils/authToken';

// ─── Count-up animation ────────────────────────────────────────────────────────

function CountUpNumber({ end, duration = 800 }: { end: number | string; duration?: number }) {
  const numericEnd = typeof end === 'string' ? parseInt(end, 10) || 0 : end;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(numericEnd * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericEnd, duration]);

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>;
}

// ─── API Helper ───────────────────────────────────────────────────────────────

const API = '/api/v1/crm';
const token = getAuthToken() || '';

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
  dismissed?: boolean;
}

// ─── Shared Components ────────────────────────────────────────────────────────

// ─── Pipeline Kanban ─────────────────────────────────────────────────────────

function PipelineKanban({ clients, onStageChange }: { clients: CrmClient[]; onStageChange: () => void }) {
  const stages = [
    { id: 'lead', label: 'Lead', color: '#6B8FA0' },
    { id: 'verified', label: 'Verified', color: '#D4A5A5' },
    { id: 'booked', label: 'Booked', color: '#D9A854' },
    { id: 'repeat', label: 'Repeat', color: '#8A9A7B' },
    { id: 'at_risk', label: 'At Risk', color: '#A85A3C' },
    { id: 'vip', label: 'VIP', color: '#D4A5A5' },
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

  function getScoreStyle(score: number) {
    if (score >= 80) return { bg: 'rgba(138, 154, 123, 0.15)', color: 'var(--sage)' };
    if (score >= 50) return { bg: 'rgba(217, 168, 84, 0.15)', color: 'var(--muted-ochre)' };
    return { bg: 'rgba(212, 165, 165, 0.15)', color: 'var(--dusty-rose)' };
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
              <h4 className="text-sm font-bold text-[var(--warm-ink)] font-label">{stage.label}</h4>
              <ClayBadge label={stageClients.length.toString()} variant="neutral" />
            </div>
            <div className="space-y-2">
              {stageClients.map(client => {
                const scoreStyle = getScoreStyle(client.reliabilityScore);
                return (
                  <div
                    key={client.id}
                    className="p-3.5 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] clay-card--interactive clay-table-row"
                    draggable
                    onDragStart={() => setDraggedClient(client.id)}
                    style={{
                      cursor: 'grab',
                      boxShadow: 'var(--shadow-soft)',
                      transition: 'transform 200ms var(--ease-smooth), box-shadow 200ms var(--ease-smooth), border-color 200ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lift)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201, 123, 90, 0.3)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-soft)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(191, 179, 163, 0.2)';
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{
                          background: `linear-gradient(135deg, var(--warm-sand) 0%, rgba(201,123,90,0.15) 100%)`,
                          color: 'var(--clay)',
                          boxShadow: '0 1px 3px rgba(180,130,90,0.1)',
                        }}
                      >
                        {client.name.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-[var(--warm-ink)] truncate" style={{ maxWidth: '120px' }}>
                        {client.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-label"
                        style={scoreStyle}
                      >
                        {client.reliabilityScore}/100
                      </span>
                      <span className="text-xs text-[var(--soft-stone)]">{client.totalJobs} jobs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alerts Feed ──────────────────────────────────────────────────────────────

function AlertsFeed({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  const typeConfig: Record<string, { icon: React.ElementType; alertVariant: string }> = {
    critical: { icon: FiAlertTriangle, alertVariant: 'critical' },
    warning: { icon: FiClock, alertVariant: 'warning' },
    opportunity: { icon: FiZap, alertVariant: 'opportunity' },
    info: { icon: FiEye, alertVariant: 'info' },
  };

  return (
    <Card hover={false} className="clay-rise">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[var(--warm-ink)] clay-heading mb-0">Revenue Alerts</h3>
        <ClayBadge label={`${alerts.filter(a => !a.dismissed).length} active`} variant="warning" />
      </div>
      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(138,154,123,0.12)] flex items-center justify-center mx-auto mb-3">
            <FiCheckCircle className="w-7 h-7" style={{ color: 'var(--sage)' }} />
          </div>
          <p className="text-sm text-[var(--soft-stone)]">All clear. No alerts.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.filter(a => !a.dismissed).slice(0, 10).map((alert, i) => {
            const config = typeConfig[alert.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={`clay-alert clay-alert--${config.alertVariant} flex items-start gap-3 clay-rise`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--clay)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--warm-ink)]">{alert.title}</p>
                  <p className="text-xs text-[var(--soft-stone)] mt-0.5">{alert.message}</p>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-2 rounded-xl clay-card--interactive shrink-0"
                  style={{
                    backgroundColor: 'rgba(232, 217, 197, 0.3)',
                    color: 'var(--soft-stone)',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(201, 123, 90, 0.12)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--clay)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232, 217, 197, 0.3)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--soft-stone)';
                  }}
                  aria-label="Dismiss alert"
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



export default function PipelineOSDashboard() {
  const [clients, setClients] = useState<CrmClient[]>([]);
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
    return <LoadingState />;
  }

  const totalClients = clients.length;
  const vipCount = clients.filter(c => c.stage === 'vip').length;
  const atRiskCount = clients.filter(c => c.stage === 'at_risk').length;
  const avgScore = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + c.reliabilityScore, 0) / clients.length)
    : 0;

  const statCards = [
    { label: 'Total Clients', value: totalClients, icon: FiUsers, color: 'var(--clay)', delay: 80 },
    { label: 'VIP', value: vipCount, icon: FiStar, color: 'var(--dusty-rose)', delay: 160 },
    { label: 'At Risk', value: atRiskCount, icon: FiAlertTriangle, color: 'var(--terracotta)', delay: 240 },
    { label: 'Avg Score', value: `${avgScore}/100`, icon: FiTrendingUp, color: 'var(--sage)', delay: 320 },
  ];

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-7 clay-fade">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] clay-heading">PipelineOS</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--soft-stone)' }}>
              Trust-Aware Revenue Engine
            </p>
          </div>
          <ClayBadge label="Live" variant="success" />
        </div>

        {error && (
          <div className="clay-alert clay-alert--critical mb-6 clay-rise">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {statCards.map((stat) => (
            <Card key={stat.label} hover={false} className="clay-rise" style={{ animationDelay: `${stat.delay}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[var(--soft-stone)] font-label">{stat.label}</p>
                  <p className="text-3xl font-bold text-[var(--warm-ink)] stat-number mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <CountUpNumber end={stat.value} duration={800} />
                  </p>
                </div>
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center clay-stat-icon"
                  style={{ backgroundColor: stat.color }}
                >
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 clay-fade clay-delay-4">
          {([
            { key: 'kanban', label: 'Pipeline Kanban' },
            { key: 'clients', label: 'Clients' },
            { key: 'alerts', label: 'Alerts' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`clay-tab flex-1 px-4 py-2.5 text-sm font-medium rounded-xl capitalize cursor-pointer font-label ${
                activeTab === t.key
                  ? 'clay-tab--active'
                  : 'clay-tab--inactive'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <TabContent
          activeTab={activeTab}
          clients={clients}
          alerts={alerts}
          onStageChange={loadAll}
          onDismissAlert={handleDismissAlert}
          loadAll={loadAll}
        />
      </div>
    </DashboardLayout>
  );
}
