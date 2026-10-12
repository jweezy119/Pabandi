import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { Chip } from '../../../components/primitives/Chip';
import type { DashboardData } from './useDashboardData';

/**
 * The four dashboard widgets that had no implementation to wire in.
 *
 * The other six — revenue, pipeline, client health, activity metrics, tasks,
 * calendar, team-as-a-table — already existed and are imported straight into
 * WIDGET_REGISTRY. These four are new, and each one shows only figures the
 * server actually returned: no stat is shown as 0 to fill a gap, and a widget
 * with nothing to say says so.
 */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-[var(--soft-stone)] py-6">
      {children}
    </div>
  );
}

function Tile({ label, value, tone = 'clay' }: { label: string; value: string; tone?: string }) {
  const colour: Record<string, string> = {
    clay: 'var(--clay)',
    sage: 'var(--sage)',
    ochre: 'var(--muted-ochre)',
  };
  return (
    <div className="p-3 rounded-xl bg-[var(--warm-sand)]/40">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--soft-stone)]">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color: colour[tone] || colour.clay }}>
        {value}
      </div>
    </div>
  );
}

/** /crm/dashboard, verbatim. */
export function StatsOverviewWidget({ data }: { data?: DashboardData }) {
  if (data?.loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[160px]" />;
  const stats = data?.stats;
  if (!stats) return <Empty>No business linked to this account yet.</Empty>;

  const completionRate = stats.totalJobs
    ? Math.round((stats.completedJobs / stats.totalJobs) * 100)
    : 0;

  return (
    <Card padding="lg" className="h-full">
      <p className="text-sm text-[var(--soft-stone)] mb-4">Key business metrics at a glance</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Active clients" value={String(stats.activeClients)} tone="sage" />
        <Tile label="Total jobs" value={String(stats.totalJobs)} />
        <Tile label="Completed" value={`${stats.completedJobs} (${completionRate}%)`} tone="ochre" />
        <Tile label="Revenue this month" value={`$${stats.monthlyRevenue.toLocaleString()}`} />
      </div>
    </Card>
  );
}

/**
 * Monthly revenue against the two costs the server records alongside it.
 *
 * Net is revenue less expenses less payroll, which is a real figure because all
 * three come from the same query — not a projection, and not a target. There is
 * no goal to progress towards: no target exists anywhere in the schema, and a
 * progress bar towards an invented number is the most convincing kind of lie.
 */
export function GoalsWidget({ data }: { data?: DashboardData }) {
  if (data?.loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[220px]" />;
  const stats = data?.stats;
  if (!stats) return <Empty>No business linked to this account yet.</Empty>;

  const costs = stats.monthlyExpenses + stats.payrollCosts;
  const net = stats.monthlyRevenue - costs;

  return (
    <Card padding="lg" className="h-full flex flex-col">
      <p className="text-sm text-[var(--soft-stone)] mb-4">This month, revenue against costs</p>
      <div className="text-center py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--soft-stone)]">Net</div>
        <div
          className="text-4xl font-black"
          style={{ color: net >= 0 ? 'var(--sage)' : 'var(--dusty-rose)' }}
        >
          {net < 0 ? '-' : ''}${Math.abs(net).toLocaleString()}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--warm-sand)]">
        <div>
          <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider">Revenue</div>
          <div className="text-lg font-bold text-[var(--warm-ink)]">${stats.monthlyRevenue.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider">Expenses</div>
          <div className="text-lg font-bold text-[var(--warm-ink)]">${stats.monthlyExpenses.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider">Payroll</div>
          <div className="text-lg font-bold text-[var(--warm-ink)]">${stats.payrollCosts.toLocaleString()}</div>
        </div>
      </div>
    </Card>
  );
}

const ALERT_TONE: Record<string, { chip: any; label: string }> = {
  critical: { chip: 'danger', label: 'Critical' },
  warning: { chip: 'warning', label: 'Warning' },
  opportunity: { chip: 'success', label: 'Opportunity' },
  info: { chip: 'info', label: 'Info' },
};

/** /crm/alerts. The server generates these from current data and upserts them. */
export function AlertsWidget({ data }: { data?: DashboardData }) {
  if (data?.loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[220px]" />;
  const alerts = data?.alerts ?? [];
  if (alerts.length === 0) return <Empty>Nothing needs your attention.</Empty>;

  return (
    <Card padding="lg" className="h-full">
      <div className="space-y-3 max-h-[280px] overflow-y-auto">
        {alerts.map((a) => {
          const tone = ALERT_TONE[a.type] || ALERT_TONE.info;
          return (
            <div key={a.id} className="p-3 rounded-xl bg-[var(--warm-sand)]/40">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-[var(--warm-ink)]">{a.title}</h4>
                <Chip label={tone.label} variant={tone.chip} size="sm" />
              </div>
              {a.message && (
                <p className="text-xs text-[var(--soft-stone)] mt-1">{a.message}</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * The top five employees by completed jobs, which is what /crm/dashboard returns.
 *
 * TeamList is the full roster table and wants six columns including hire date and
 * delivery score; inside a third-of-the-row dashboard card it is unreadable. This
 * is the same data at the size that widget actually has.
 */
export function TeamWidget({ data }: { data?: DashboardData }) {
  if (data?.loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[220px]" />;
  const team = data?.team ?? [];
  if (team.length === 0) return <Empty>No team members yet.</Empty>;

  return (
    <Card padding="lg" className="h-full">
      <div className="space-y-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--warm-ink)] truncate">{m.name}</div>
              <div className="text-xs text-[var(--soft-stone)] truncate">{m.role}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-[var(--warm-ink)]">{m.jobsCompleted}</div>
              <div className="text-[10px] text-[var(--soft-stone)] uppercase tracking-wider">jobs</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}