import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, EmptyState, ClayBadge } from '../../../components/primitives';
import { FiPhone, FiMail, FiMapPin, FiX, FiCheckCircle, FiAlertTriangle, FiInfo, FiAlertOctagon } from 'react-icons/fi';

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
  tags?: string[];
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

interface TabContentProps {
  activeTab: 'kanban' | 'clients' | 'alerts';
  clients: CrmClient[];
  alerts: Alert[];
  onStageChange: (id: string, stage: string) => void;
  onDismissAlert: (id: string) => void;
  loadAll: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'New Leads',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed Won',
  lost: 'Closed Lost',
  vip: 'VIP Clients',
  at_risk: 'At Risk',
};

const STAGE_COLORS: Record<string, string> = {
  lead: 'var(--clay)',
  qualified: 'var(--sage)',
  proposal: 'var(--muted-ochre)',
  negotiation: 'var(--terracotta)',
};

const typeConfig: Record<string, { icon: React.ComponentType<any>; alertVariant: string }> = {
  info: { icon: FiInfo, alertVariant: 'info' },
  warning: { icon: FiAlertTriangle, alertVariant: 'warning' },
  danger: { icon: FiAlertOctagon, alertVariant: 'critical' },
  success: { icon: FiCheckCircle, alertVariant: 'success' },
};

function KanbanColumn({ title, clients, color, onDragEnd }: { title: string; clients: CrmClient[]; color: string; onDragEnd?: (id: string, stage: string) => void }) {
  const [draggedClient, setDraggedClient] = useState<string | null>(null);
  return (
    <div className="flex flex-col" style={{ minWidth: '260px', flex: '1 1 0' }}>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-3" style={{ background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`, border: `1px solid ${color}30`, color }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-label)' }}>{title}</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${color}18`, color: `${color}cc` }}>{clients.length}</span>
      </div>
      <div className="flex-1 rounded-2xl p-2 space-y-2 overflow-y-auto" style={{ background: 'rgba(245, 239, 230, 0.4)', border: '1px solid rgba(191, 179, 163, 0.15)', minHeight: '200px', maxHeight: 'calc(100vh - 320px)' }}
        onDragOver={e => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedClient && onDragEnd) {
            const newStage = (e.currentTarget as HTMLElement).getAttribute('data-stage') ?? '';
            onDragEnd(draggedClient, newStage);
          }
          setDraggedClient(null);
        }}
      >
        {clients.map(client => (
          <div key={client.id} draggable onDragStart={() => setDraggedClient(client.id)} onDragEnd={() => setDraggedClient(null)}
            className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(191,179,163,0.15)] bg-white/70 clay-card--interactive"
            style={{ cursor: 'grab', boxShadow: 'var(--shadow-soft)', transition: 'transform 200ms var(--ease-smooth), box-shadow 200ms var(--ease-smooth), border-color 200ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lift)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201, 123, 90, 0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-soft)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(191, 179, 163, 0.2)'; }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--warm-sand) 0%, rgba(201,123,90,0.15) 100%)', color: 'var(--clay)', boxShadow: '0 2px 6px rgba(201,123,90,0.15)' }}>
              {client.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--warm-ink)] truncate">{client.name}</p>
              <div className="flex items-center gap-2 text-xs text-[var(--soft-stone)] mt-1">
                {client.phone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{client.phone}</span>}
                {client.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{client.email}</span>}
                {client.address && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{client.address.split(',')[0]}</span>}
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(138, 154, 123, 0.15)', color: 'var(--sage)', border: '1px solid rgba(138, 154, 123, 0.2)' }}>
              {client.reliabilityScore}
            </span>
          </div>
        ))}
        {clients.length === 0 && <div className="text-center py-8 text-sm" style={{ color: 'var(--soft-stone)', fontStyle: 'italic' }}>No clients in this stage</div>}
      </div>
    </div>
  );
}

function PipelineKanban({ clients, onStageChange }: { clients: CrmClient[]; onStageChange: (id: string, stage: string) => void }) {
  const stages = ['lead', 'qualified', 'proposal', 'negotiation'] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--warm-ink)] clay-heading">Pipeline Kanban</h2>
        <ClayBadge label={`${clients.length} total`} variant="neutral" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {stages.map(stage => (
          <KanbanColumn key={stage} title={STAGE_LABELS[stage]} clients={clients.filter(c => c.stage === stage)} color={STAGE_COLORS[stage]} onDragEnd={(id, newStage) => onStageChange(id, newStage)} />
        ))}
      </div>
    </div>
  );
}

function AlertsFeed({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  const activeAlerts = alerts.filter(a => !a.dismissed);
  if (activeAlerts.length === 0) return null;
  return (
    <Card hover={false} className="clay-rise">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[var(--warm-ink)] clay-heading mb-0">Revenue Alerts</h3>
        <ClayBadge label={`${activeAlerts.length} active`} variant="warning" />
      </div>
      {activeAlerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(138,154,123,0.12)] flex items-center justify-center mx-auto mb-3">
            <FiCheckCircle className="w-7 h-7" style={{ color: 'var(--sage)' }} />
          </div>
          <p className="text-sm text-[var(--soft-stone)]">All clear. No alerts.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeAlerts.slice(0, 10).map((alert, i) => {
            const config = typeConfig[alert.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`clay-alert clay-alert--${config.alertVariant} flex items-start gap-3 clay-rise`} style={{ animationDelay: `${i * 60}ms` }}>
                <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--clay)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--warm-ink)]">{alert.title}</p>
                  <p className="text-xs text-[var(--soft-stone)] mt-0.5">{alert.message}</p>
                </div>
                <button onClick={() => onDismiss(alert.id)} className="p-2 rounded-xl clay-card--interactive shrink-0" style={{ backgroundColor: 'rgba(232, 217, 197, 0.3)', color: 'var(--soft-stone)', transition: 'background-color 150ms ease, color 150ms ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(201, 123, 90, 0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--clay)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232, 217, 197, 0.3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--soft-stone)'; }}
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

export default function TabContent({ activeTab, clients, alerts, onStageChange, onDismissAlert, loadAll }: TabContentProps) {
  return (
    <AnimatePresence mode="wait">
      {activeTab === 'kanban' && (
        <motion.div
          key="kanban"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
          className="space-y-6"
        >
          <PipelineKanban clients={clients} onStageChange={onStageChange} />
          <AlertsFeed alerts={alerts} onDismiss={onDismissAlert} />
        </motion.div>
      )}
      {activeTab === 'alerts' && (
        <motion.div
          key="alerts"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
        >
          <AlertsFeed alerts={alerts} onDismiss={onDismissAlert} />
        </motion.div>
      )}
      {activeTab === 'clients' && (
        <motion.div
          key="clients"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
          className="space-y-6"
        >
          <Card hover={false} className="clay-rise clay-delay-5">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] clay-heading mb-5">Client Directory</h2>
            {clients.length === 0 ? (
              <EmptyState icon="groups" title="No Clients Yet" description="Add your first client to start tracking deals and revenue." actionLabel="Add Client" onAction={loadAll} />
            ) : (
              <div className="space-y-2.5">
                {clients.map((client, i) => (
                  <div key={client.id} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] clay-card--interactive clay-table-row clay-rise" style={{ animationDelay: `${i * 60}ms`, boxShadow: 'var(--shadow-soft)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lift)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201, 123, 90, 0.3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-soft)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(191, 179, 163, 0.2)'; }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--warm-sand) 0%, rgba(201,123,90,0.15) 100%)', color: 'var(--clay)', boxShadow: '0 2px 6px rgba(201,123,90,0.15)' }}>
                      {client.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--warm-ink)] truncate">{client.name}</p>
                      <div className="flex items-center gap-3 text-xs text-[var(--soft-stone)] mt-0.5">
                        {client.phone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{client.phone}</span>}
                        {client.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{client.email}</span>}
                        {client.address && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{client.address.split(',')[0]}</span>}
                      </div>
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          {client.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--clay)]/10 text-[var(--clay)]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ backgroundColor: 'rgba(201, 123, 90, 0.1)', color: 'var(--clay)' }}>
                      <span className="text-xs font-bold">{client.reliabilityScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
