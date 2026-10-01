import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { moduleRegistry } from './index';
import type {
  ModuleFacts,
  ModuleId,
  ModuleResult,
  ModuleScope,
  ModuleTimelineEntry,
} from './contract';

/**
 * BusinessGraph — the unified read surface for the service economy.
 *
 * Every layer answers the same three questions (what happened, what it was
 * worth, what it did to trust) in one shape. This service fans out across every
 * installed module and merges the answers into a single pulse, so a dashboard
 * makes one call instead of six and cannot accidentally disagree with itself.
 *
 * The merge rules matter as much as the fan-out:
 *
 *   • `revenue` and `cost` are summed across modules. Those are disjoint by
 *     construction — a booking is not also a CRM job.
 *   • `cash` is NOT summed into revenue. Capital raised and payment settlement
 *     are movements of money that were already counted as revenue somewhere.
 *     Summing them would double-book every sale.
 *   • A module that errors is reported as an error and excluded from the
 *     totals, and the totals are marked partial. Silently treating a failed
 *     read as zero is how a dashboard ends up lying.
 */

export interface BusinessPulse {
  businessId: string;
  serviceBusinessId: string | null;
  generatedAt: string;
  range: { from: string; to: string };

  /** Modules that answered, with their per-module contribution. */
  modules: {
    id: ModuleId;
    status: ModuleResult<unknown>['status'];
    reason?: string;
    facts?: ModuleFacts;
  }[];

  /** Merged totals. `partial` is true when any module failed to answer. */
  totals: {
    revenue: number;
    cost: number;
    margin: number;
    outstanding: number;
    currency: string;
    /** True when at least one module errored and was excluded. */
    partial: boolean;
  };

  /** Trust posture, assembled from whichever module supplied it. */
  trust: {
    available: boolean;
    passportId?: string;
    level?: string | null;
    overall?: number | null;
    verified?: boolean;
    fraudFlag?: boolean;
    /** Scoped scores with their sample sizes, so a score is never read bare. */
    scoped?: {
      dimension: string;
      score: number | null;
      sampleSize: number | null;
    }[];
  };

  /** Merged, reverse-chronological across every module. */
  timeline: ModuleTimelineEntry[];

  /** Money that moved but must not be counted as revenue. */
  flows: {
    capitalRaised: number;
    settledPayments: number;
    treasuryTotal: number;
  };
}

export interface ParseRangeOptions {
  /** Accepts `?range=30d` / `7d` / `90d`, or explicit `from`/`to` ISO dates. */
  range?: string;
  from?: string;
  to?: string;
  /** Defaults to 30 days when nothing parseable is supplied. */
  defaultDays?: number;
}

export function parseRange(opts: ParseRangeOptions = {}): { from: Date; to: Date } {
  const to = opts.to ? new Date(opts.to) : new Date();
  let from: Date | undefined = opts.from ? new Date(opts.from) : undefined;

  if (!from && opts.range) {
    const match = /^(\d+)\s*(d|w|m)$/i.exec(opts.range.trim());
    if (match) {
      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();
      from = new Date(to);
      if (unit === 'd') from.setUTCDate(from.getUTCDate() - amount);
      else if (unit === 'w') from.setUTCDate(from.getUTCDate() - amount * 7);
      else from.setUTCMonth(from.getUTCMonth() - amount);
    }
  }

  if (!from || Number.isNaN(from.getTime())) {
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (opts.defaultDays ?? 30));
  }

  // A reversed range would silently return empty facts rather than an error.
  if (from > to) {
    const swap = from;
    from = to;
    to.setTime(swap.getTime());
  }

  return { from, to };
}

/**
 * Resolve which modules a business has switched on.
 *
 * Core modules are always on. Anything installable must have an enabled row in
 * `crm_module_installs`; a business with no rows at all gets the defaults, so a
 * newly enrolled business is not staring at an empty platform.
 */
export async function resolveInstalledModules(
  serviceBusinessId: string | null
): Promise<ModuleId[]> {
  const catalogue = moduleRegistry.all();
  const alwaysOn = catalogue.filter((m) => !m.installable).map((m) => m.id);

  if (!serviceBusinessId) return alwaysOn;

  const installs = await prisma.crmModuleInstall.findMany({
    where: { serviceBusinessId },
    select: { moduleId: true, enabled: true },
  });

  if (installs.length === 0) {
    return catalogue.filter((m) => !m.installable).map((m) => m.id);
  }

  const enabled = new Set(
    installs.filter((i) => i.enabled).map((i) => i.moduleId as ModuleId)
  );
  return [...alwaysOn, ...enabled].filter((id, i, arr) => arr.indexOf(id) === i);
}

/**
 * Build the unified pulse for a business.
 *
 * Module reads run concurrently and independently: one layer being slow or
 * broken must not delay or blank the others.
 */
export async function buildPulse(
  businessId: string,
  serviceBusinessId: string | null,
  range: { from: Date; to: Date }
): Promise<BusinessPulse> {
  const scope: ModuleScope = { businessId, serviceBusinessId, range };
  const installed = await resolveInstalledModules(serviceBusinessId);

  const factsById = new Map<ModuleId, ModuleResult<ModuleFacts>>();
  const timelineById = new Map<ModuleId, ModuleResult<ModuleTimelineEntry[]>>();

  // Read every module for facts and timeline concurrently.
  await Promise.all(
    installed.map(async (id) => {
      const module = moduleRegistry.get(id);
      if (!module) {
        factsById.set(id, { status: 'unavailable', reason: 'Module not registered' });
        timelineById.set(id, { status: 'unavailable', reason: 'Module not registered' });
        return;
      }

      const [facts, timeline] = await Promise.all([
        guard(() => module.facts(scope), id, 'facts'),
        guard(() => module.timeline(scope), id, 'timeline'),
      ]);
      factsById.set(id, facts);
      timelineById.set(id, timeline);
    })
  );

  // ── Merge money ────────────────────────────────────────────────────────────
  let revenue = 0;
  let cost = 0;
  let outstanding = 0;
  let partial = false;
  let currency = 'USD';

  const flows = { capitalRaised: 0, settledPayments: 0, treasuryTotal: 0 };

  for (const id of installed) {
    const result = factsById.get(id);
    if (!result || result.status !== 'ok') {
      if (result?.status === 'error') partial = true;
      continue;
    }

    const money = result.data.money;
    const revenueMoney = money.revenue;
    const costMoney = money.cost;
    const cashMoney = money.cash;

    if (revenueMoney) {
      revenue += revenueMoney.net || 0;
      outstanding += revenueMoney.outstanding || 0;
      currency = revenueMoney.currency || currency;
    }
    if (costMoney) {
      cost += costMoney.net || 0;
      outstanding += costMoney.outstanding || 0;
    }
    // `cash` is tracked but never added to revenue — see the module docblock.
    if (cashMoney) {
      if (id === 'capital') flows.capitalRaised += cashMoney.net || 0;
      if (id === 'payments') flows.settledPayments += cashMoney.net || 0;
      if (id === 'capital' && result.data.series) {
        for (const point of result.data.series) {
          if (point.key === 'capital_raised_by_bucket') {
            flows.treasuryTotal += point.points.reduce((s, p) => s + p.v, 0);
          }
        }
      }
    }
  }

  // ── Merge timeline ─────────────────────────────────────────────────────────
  const timeline = [...timelineById.values()]
    .filter((r): r is { status: 'ok'; data: ModuleTimelineEntry[] } => r?.status === 'ok')
    .flatMap((r) => r.data)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 200);

  const trust = await buildTrustView(businessId, factsById);

  return {
    businessId,
    serviceBusinessId,
    generatedAt: new Date().toISOString(),
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    modules: installed.map((id) => {
      const result = factsById.get(id);
      return {
        id,
        status: result?.status ?? 'unavailable',
        reason: result && result.status !== 'ok' ? result.reason : undefined,
        facts: result?.status === 'ok' ? result.data : undefined,
      };
    }),
    totals: {
      revenue,
      cost,
      margin: revenue - cost,
      outstanding,
      currency,
      partial,
    },
    trust,
    timeline,
    flows,
  };
}

/**
 * Trust is assembled from the trust module's facts, but the scopes are only
 * meaningful with their sample sizes, so those travel together.
 */
async function buildTrustView(
  businessId: string,
  factsById: Map<ModuleId, ModuleResult<ModuleFacts>>
): Promise<BusinessPulse['trust']> {
  const result = factsById.get('trust');
  if (!result || result.status !== 'ok') return { available: false };

  // Re-read the passport for the fields that are not counters.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  if (!business?.ownerId) return { available: false };

  const passport = await prisma.trustPassport.findUnique({
    where: { userId: business.ownerId },
    select: {
      id: true,
      level: true,
      score: true,
      verified: true,
      fraudFlag: true,
      showUpScore: true,
      showUpSampleSize: true,
      paymentScore: true,
      paymentSampleSize: true,
      deliveryScore: true,
      deliverySampleSize: true,
      tenancyScore: true,
      tenancySampleSize: true,
      freightScore: true,
      freightSampleSize: true,
    },
  });
  if (!passport) return { available: false };

  return {
    available: true,
    passportId: passport.id,
    level: passport.level,
    overall: passport.score,
    verified: passport.verified ?? false,
    fraudFlag: passport.fraudFlag ?? false,
    scoped: [
      { dimension: 'showUp', score: passport.showUpScore, sampleSize: passport.showUpSampleSize },
      { dimension: 'payment', score: passport.paymentScore, sampleSize: passport.paymentSampleSize },
      { dimension: 'delivery', score: passport.deliveryScore, sampleSize: passport.deliverySampleSize },
      { dimension: 'tenancy', score: passport.tenancyScore, sampleSize: passport.tenancySampleSize },
      { dimension: 'freight', score: passport.freightScore, sampleSize: passport.freightSampleSize },
    ],
  };
}

/**
 * Turn any throw into a typed error result so one broken layer cannot take down
 * the whole fan-out.
 */
async function guard<T>(
  fn: () => Promise<ModuleResult<T>>,
  moduleId: ModuleId,
  phase: string
): Promise<ModuleResult<T>> {
  try {
    return await fn();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`[BusinessGraph] ${moduleId}.${phase} failed: ${reason}`);
    return { status: 'error', reason, moduleId };
  }
}

/**
 * Health of every registered module, installed or not. Used by the module
 * catalogue UI and by `/health` to explain a degraded platform.
 */
export async function moduleHealth() {
  const modules = moduleRegistry.all();
  const results = await Promise.all(
    modules.map(async (m) => {
      try {
        return { id: m.id, key: m.key, label: m.label, ...(await m.health()) };
      } catch (err) {
        return {
          id: m.id,
          key: m.key,
          label: m.label,
          ok: false,
          latencyMs: 0,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );
  return results;
}

/**
 * Enable or disable a module for a business.
 *
 * Dependency edges are enforced: installing a module whose `requires` are not
 * satisfied installs those first, because a module that reports `unavailable`
 * because of a missing prerequisite is indistinguishable from a bug.
 */
export async function setModuleEnabled(
  serviceBusinessId: string,
  moduleId: ModuleId,
  enabled: boolean
): Promise<ModuleId[]> {
  const module = moduleRegistry.get(moduleId);
  if (!module) {
    throw new Error(`Unknown module: ${moduleId}`);
  }

  const toEnable: ModuleId[] = enabled ? [moduleId, ...module.requires] : [];

  for (const id of toEnable) {
    const target = moduleRegistry.get(id);
    if (!target) continue;
    await prisma.crmModuleInstall.upsert({
      where: {
        serviceBusinessId_moduleId: { serviceBusinessId, moduleId: id },
      },
      create: { serviceBusinessId, moduleId: id, enabled: true },
      update: { enabled: true },
    });
  }

  if (!enabled) {
    // Anything that requires this module must go too, otherwise it would be left
    // in a permanently broken state.
    const dependents = moduleRegistry
      .all()
      .filter((m) => m.requires.includes(moduleId))
      .map((m) => m.id);

    await prisma.crmModuleInstall.updateMany({
      where: {
        serviceBusinessId,
        moduleId: { in: [moduleId, ...dependents] },
      },
      data: { enabled: false },
    });
  }

  return resolveInstalledModules(serviceBusinessId);
}