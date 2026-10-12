import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../../../utils/authToken';

/**
 * The data behind the Contact OS dashboard widgets.
 *
 * WHY THIS EXISTS
 * Every entry in WIDGET_REGISTRY was `component: () => null`, so the dashboard
 * rendered ten bordered boxes with a title and nothing inside. The widget
 * components themselves were real and working — they are what ReportWidgetGrid
 * renders on the reports page — but nothing ever imported them into the
 * registry, and the dashboard called neither /crm/dashboard nor /crm/alerts.
 * A page whose entire body is empty boxes reads, from outside, as "not loading".
 *
 * The registry hands each widget a single `data` prop, so the shaping happens
 * here once rather than in ten adapters.
 *
 * EVERY NUMBER BELOW IS DERIVED, NEVER ASSUMED
 * Revenue splits come from real invoices by status; pipeline from real deals by
 * stage; client health from real stage/reliability/spend. Where an endpoint
 * fails or returns nothing the widget renders its empty state. There is no
 * fallback that fills a gap with a plausible-looking figure — a dashboard that
 * invents its own numbers is worse than one that admits it has none.
 */

const API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1`;

/** Invoice statuses the server actually writes. Anything else counts as unpaid. */
const INVOICE_STATUSES = { draft: 'draft', sent: 'sent', paid: 'paid', overdue: 'overdue' } as const;

export interface DashboardData {
  loading: boolean;
  stats: {
    totalJobs: number;
    completedJobs: number;
    activeClients: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    payrollCosts: number;
    topEmployees: any[];
  } | null;
  revenue: { billed: number; collected: number; outstanding: number };
  pipeline: { stage: string; count: number; value: number }[];
  clientHealth: { atRisk: any[]; newClients: any[]; topClients: any[] };
  alerts: any[];
  activity: { total: number; completionRate: number; timeline: { date: string; count: number }[] };
  tasks: any[];
  team: any[];
  jobs: any[];
}

const EMPTY: DashboardData = {
  loading: true,
  stats: null,
  revenue: { billed: 0, collected: 0, outstanding: 0 },
  pipeline: [],
  clientHealth: { atRisk: [], newClients: [], topClients: [] },
  alerts: [],
  activity: { total: 0, completionRate: 0, timeline: [] },
  tasks: [],
  team: [],
  jobs: [],
};

/**
 * Both shapes are in the wild: crm.routes.ts answers `{ success, data }`,
 * activity.routes.ts and task.routes.ts answer a bare array. Guessing one of
 * them turns a working endpoint into a permanent empty widget.
 */
function unwrap(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/** A failed request yields `[]` rather than throwing, so one dead endpoint cannot blank the whole dashboard. */
async function get(path: string, token: string): Promise<any[]> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    return unwrap(await res.json());
  } catch {
    return [];
  }
}

async function getOne(path: string, token: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function shapeRevenue(invoices: any[]) {
  // Drafts are not billed. Everything else is; `paid` is collected and the rest
  // is outstanding. Deriving outstanding as billed-minus-collected keeps the
  // three figures from disagreeing, which they do if each is totalled separately.
  const billedRows = invoices.filter((i) => i.status !== INVOICE_STATUSES.draft);
  const billed = billedRows.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
  const collected = billedRows
    .filter((i) => i.status === INVOICE_STATUSES.paid)
    .reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
  return { billed, collected, outstanding: billed - collected };
}

function shapePipeline(deals: any[]) {
  const byStage = new Map<string, { stage: string; count: number; value: number }>();
  for (const deal of deals) {
    const stage = deal.stage || 'LEAD';
    const row = byStage.get(stage) || { stage, count: 0, value: 0 };
    row.count += 1;
    row.value += Number(deal.value || 0);
    byStage.set(stage, row);
  }
  return [...byStage.values()].sort((a, b) => a.stage.localeCompare(b.stage));
}

function shapeClientHealth(clients: any[]) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    // `at_risk` is the stage the trust engine writes; a low reliability score is
    // the same judgement reached independently, and a client can be one without
    // the other having been recomputed yet.
    atRisk: clients.filter((c) => c.stage === 'at_risk' || Number(c.reliabilityScore || 0) < 40),
    newClients: clients.filter((c) => new Date(c.createdAt).getTime() >= thirtyDaysAgo),
    topClients: [...clients].sort((a, b) => Number(b.totalSpent || 0) - Number(a.totalSpent || 0)).slice(0, 5),
  };
}

function shapeActivity(activities: any[]) {
  const tasks = activities.filter((a) => a.type === 'TASK');
  const completed = tasks.filter((t) => t.completed).length;

  // One bucket per day for the last 14, including days with nothing recorded, so
  // the bar chart's x-axis is time rather than a list of arbitrary dates.
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(days.map((d) => [d.date, d]));
  for (const a of activities) {
    const bucket = index.get(new Date(a.createdAt).toISOString().slice(0, 10));
    if (bucket) bucket.count += 1;
  }

  return {
    total: activities.length,
    completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    timeline: days,
  };
}

/**
 * @param clients already-fetched clients, when the caller has them. ContactOSPage
 *   has just fetched this list to render it below the dashboard; re-requesting it
 *   here would be a second identical round trip on every page load.
 */
export function useDashboardData(clients?: any[] | null) {
  const [data, setData] = useState<DashboardData>(EMPTY);

  const load = useCallback(async () => {
    const token = getAuthToken() || '';
    if (!token) {
      setData({ ...EMPTY, loading: false });
      return;
    }

    const [stats, deals, invoices, alerts, jobs, activities, tasks] = await Promise.all([
      getOne('/crm/dashboard', token),
      get('/crm/deals', token),
      get('/crm/invoices', token),
      get('/crm/alerts', token),
      get('/crm/jobs', token),
      get('/crm/activities', token),
      get('/crm/tasks', token),
    ]);

    const resolvedClients = Array.isArray(clients) ? clients : await get('/crm/clients', token);

    setData({
      loading: false,
      stats,
      revenue: shapeRevenue(invoices),
      pipeline: shapePipeline(deals),
      clientHealth: shapeClientHealth(resolvedClients),
      alerts,
      activity: shapeActivity(activities),
      tasks,
      team: stats?.topEmployees ?? [],
      jobs,
    });
  }, [clients]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, reload: load };
}