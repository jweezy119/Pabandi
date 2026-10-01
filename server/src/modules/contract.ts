/**
 * Pabandi Module Contract
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The platform thesis: Pabandi is *infrastructure and trust protocol*, and the
 * business OS layers — booking, capital, property, freight, CRM — are modules
 * that plug into it. A module never owns identity, money movement, or trust
 * scoring. Those are the protocol, supplied by Pabandi. A module supplies:
 *
 *   • a descriptor  — what it is, what it costs, what it depends on
 *   • facts         — a normalised read surface over its own tables
 *   • a timeline    — what happened, in a shape the unified timeline can merge
 *
 * Three rules keep the platform from collapsing back into silos:
 *
 *   1. Modules read through `businessId` (the platform `Business`), never
 *      through a private id scheme. That is what makes cross-layer joins
 *      possible at all.
 *   2. Modules emit events tagged with their layer id. The trust protocol
 *      subscribes; modules never write another module's score.
 *   3. A module that is absent must degrade to `unavailable`, never to a thrown
 *      error or a misleading zero. A business with no property portfolio should
 *      see "Property not installed", not "0 tenants, revenue 0".
 */

import type { PrismaClient } from '@prisma/client';

/** Identifies a business across every layer. */
export interface ModuleScope {
  /** Platform `Business` id — the join key for all cross-layer reads. */
  businessId: string;
  /** CRM service-business id, where the caller has one. */
  serviceBusinessId?: string | null;
  /** Window for any range-shaped fact set. */
  range: { from: Date; to: Date };
}

/**
 * One module's contribution to a business's financial picture.
 *
 * Every value is in the business's operating currency and already net of the
 * module's own adjustments. The pulse layer sums these; it never re-derives them.
 */
export interface ModuleMoney {
  /** Gross booked in the window. */
  gross: number;
  /** Gross minus refunds, chargebacks, defaults and unrecovered balances. */
  net: number;
  /** What is expected but not yet collected (invoices sent, rent due, etc.). */
  outstanding: number;
  currency: string;
}

export interface ModuleFacts {
  /**
   * Counters for the window. Convention: `null` means "not applicable for this
   * module", which is distinct from `0` meaning "none happened".
   */
  counts: Record<string, number | null>;
  money: Partial<Record<'revenue' | 'cost' | 'cash', ModuleMoney>>;
  /** Free-form module-specific series, already normalised. */
  series?: { key: string; points: { t: string; v: number }[] }[];
}

export interface ModuleTimelineEntry {
  at: Date;
  moduleId: ModuleId;
  kind: string;
  /** Denormalised subject so the unified timeline can render without a join. */
  subject?: { id: string; label: string; href?: string };
  summary: string;
  /** Trust or money impact, if the entry moved a score or a balance. */
  impact?: { trustDelta?: number; amount?: number; currency?: string };
}

/** Outcome of reading a module for a scope. */
export type ModuleResult<T> =
  | { status: 'ok'; data: T }
  /** Installed and answering, but this business has no footprint here. */
  | { status: 'empty'; reason: string }
  /** Module not installed for this business. */
  | { status: 'unavailable'; reason: string }
  /** Module is installed but its own read failed. Never silently zeroed. */
  | { status: 'error'; reason: string; moduleId: ModuleId };

export interface ModuleHealth {
  ok: boolean;
  /** Round-trip of the module's own query, milliseconds. */
  latencyMs: number;
  detail?: string;
}

export type ModuleId =
  | 'core'
  | 'crm'
  | 'booking'
  | 'serviceBooking'
  | 'property'
  | 'capital'
  | 'trust'
  | 'payments';

/**
 * The uniform interface every layer implements.
 *
 * Implementations must be side-effect free: `facts` and `timeline` are read by
 * dashboards that poll, and by the MCP tool surface that agents call.
 */
export interface PabandiModule {
  id: ModuleId;
  /** Stable lowercase key used in URLs, DB rows and MCP tool names. */
  key: string;
  label: string;
  /** One line for the module catalogue UI. */
  blurb: string;
  /** True when a business must explicitly install it; false for core. */
  installable: boolean;
  /** Module ids that must be installed for this one to be meaningful. */
  requires: ModuleId[];
  /**
   * Events this module publishes. The registry uses it to build the event
   * routing table, so a module's cross-layer effects are declared, not implied.
   */
  emits: string[];

  facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>>;
  timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>>;
  health(): Promise<ModuleHealth>;
}

/**
 * Registry of every installed module.
 *
 * Modules self-register at import time. `index.ts` imports the registry, which
 * pulls in the catalogue — the same "load one thing, get the whole system"
 * property the route map and `pabandiToolsRegistry` already rely on.
 */
export class ModuleRegistry {
  private modules = new Map<ModuleId, PabandiModule>();

  register(module: PabandiModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module ${module.id} is already registered`);
    }
    this.modules.set(module.id, module);
  }

  get(id: ModuleId): PabandiModule | undefined {
    return this.modules.get(id);
  }

  /** Throwing accessor, for call sites that have already checked presence. */
  require(id: ModuleId): PabandiModule {
    const module = this.modules.get(id);
    if (!module) throw new Error(`Module ${id} is not registered`);
    return module;
  }

  all(): PabandiModule[] {
    return [...this.modules.values()];
  }

  /** Catalogue for the UI — everything installable, not just what's installed. */
  catalogue(): {
    id: ModuleId;
    key: string;
    label: string;
    blurb: string;
    requires: ModuleId[];
  }[] {
    return this.all().map((m) => ({
      id: m.id,
      key: m.key,
      label: m.label,
      blurb: m.blurb,
      requires: m.requires,
    }));
  }

  /**
   * Validate the registry itself: an unsatisfiable `requires` edge would
   * silently produce a module that can never report ok.
   */
  assertSatisfiable(): void {
    for (const module of this.modules.values()) {
      for (const dep of module.requires) {
        if (!this.modules.has(dep)) {
          throw new Error(
            `Module ${module.id} requires ${dep}, which is not registered`
          );
        }
      }
    }
  }
}

export const moduleRegistry = new ModuleRegistry();

/**
 * Wrap a module read so a failure becomes a typed `error` result rather than an
 * exception that tears down a whole dashboard fan-out.
 *
 * This is the single most important function in the file: it is what makes
 * "modular" mean *degrades gracefully* rather than *one broken layer blanks the
 * entire screen*.
 */
export async function readModule<T>(
  module: PabandiModule,
  fn: () => Promise<ModuleResult<T>>
): Promise<ModuleResult<T>> {
  try {
    return await fn();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: 'error', reason, moduleId: module.id };
  }
}

/** Convenience for modules with no footprint yet. */
export function emptyResult<T>(reason: string): ModuleResult<T> {
  return { status: 'empty', reason };
}

export function unavailableResult<T>(reason: string): ModuleResult<T> {
  return { status: 'unavailable', reason };
}

/** Zero-valued money, for modules that genuinely have no money dimension. */
export function zeroMoney(currency = 'USD'): ModuleMoney {
  return { gross: 0, net: 0, outstanding: 0, currency };
}

/**
 * Milliseconds spent inside `fn`, for `health()`.
 */
export async function timed(fn: () => Promise<unknown>): Promise<number> {
  const started = Date.now();
  await fn();
  return Date.now() - started;
}

export type { PrismaClient };