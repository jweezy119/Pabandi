/**
 * Business OS module descriptors (client side).
 *
 * The server owns the authoritative registry — a module is only real if
 * `/api/v1/business-os/modules` says so. This file exists for two reasons the
 * server response cannot cover:
 *
 *   1. Presentation. Labels, icons and the order the workspace renders modules
 *      in are a design decision, not a protocol one.
 *   2. Navigation targets. Each module maps to a route in this app, and that
 *      mapping is client-only.
 *
 * The one rule that matters: never treat a module as available based on this
 * file. Availability always comes from the server's `installed` flag, because
 * only the server knows whether a prerequisite resolved.
 *
 * ROUTES ARE A CONTRACT, AND THESE FIVE WERE BROKEN
 * ------------------------------------------------
 * Five of the six modules pointed at `/crm/<key>`, and App.tsx never registered
 * those paths. A customer clicking "Bookings" navigated to a URL with no route and
 * got a blank page — the workspace shell calls `navigate(descriptor.route)`
 * unconditionally, with no fallback and no disabled state.
 *
 * The live surface is the `contact/*` tree. These now point at routes that exist:
 *
 *   booking  -> /contact            the workspace itself lists bookings and jobs
 *   capital  -> /contact/money-flow Mudarabah pools, P&L, payouts
 *   payments -> /contact/invoices   settlement and invoices
 *   property -> null                no page exists
 *   trust    -> null                no page exists
 *
 * `route: null` is the honest answer for those two. The server still registers
 * both modules, so they remain visible in the grid; a `ModuleCard` with no route
 * renders as unavailable rather than navigating nowhere. Inventing placeholder
 * pages would have hidden the gap behind a page that looks built.
 */

export type ModuleId =
  | 'core'
  | 'crm'
  | 'booking'
  | 'property'
  | 'capital'
  | 'trust'
  | 'payments';

export interface ModuleDescriptor {
  id: ModuleId;
  /** URL/route key, as the server's catalogue reports it. Same value as `id`
   *  today, but kept separate because the wire format distinguishes them. */
  key: ModuleId;
  label: string;
  /** Single glyph. Deliberately not an icon library — the nav is text-dense. */
  glyph: string;
  /** One line shown in the module catalogue. */
  blurb: string;
  /** Where this module's full workspace lives. */
  /** Where this module navigates. Null when no page exists yet — the card
   *  renders as unavailable rather than sending the customer to a blank URL. */
  route: string | null;
  /** Accent colour, from the design-system palette. */
  accent: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'textMuted';
  /** Paint order in the workspace shell. Lower comes first. */
  order: number;
}

/**
 * The catalogue. Order is deliberate: the business's own operations (CRM) sit at
 * the top, money and capital next, then the protocol-level layers (payments,
 * trust) which are infrastructure the business consumes rather than operates.
 */
export const MODULES: ModuleDescriptor[] = [
  {
    id: 'crm',
    key: 'crm',
    label: 'CRM',
    glyph: '◈',
    blurb: 'Clients, jobs, team, payroll and expenses',
    route: '/contact',
    accent: 'primary',
    order: 10,
  },
  {
    id: 'booking',
    key: 'booking',
    label: 'Bookings',
    glyph: '▤',
    blurb: 'Reservations, deposits, check-ins and no-shows',
    route: '/contact',
    accent: 'accent',
    order: 20,
  },
  {
    id: 'property',
    key: 'property',
    label: 'Property',
    glyph: '⌂',
    blurb: 'Rent roll, tenant risk, leases and maintenance',
    route: null,
    accent: 'secondary',
    order: 30,
  },
  {
    id: 'capital',
    key: 'capital',
    label: 'Capital',
    glyph: '◐',
    blurb: 'Mudarabah pools, credit capacity and payouts',
    route: '/contact/money-flow',
    accent: 'success',
    order: 40,
  },
  {
    id: 'payments',
    key: 'payments',
    label: 'Payments',
    glyph: '◉',
    blurb: 'Card, wallet, Raast and on-chain settlement',
    route: '/contact/invoices',
    accent: 'warning',
    order: 50,
  },
  {
    id: 'trust',
    key: 'trust',
    label: 'Trust',
    glyph: '✦',
    blurb: 'Passport scores, verification and fraud signals',
    route: null,
    accent: 'danger',
    order: 60,
  },
];

export const CORE_MODULE_ID: ModuleId = 'core';

export function moduleById(id: ModuleId): ModuleDescriptor | undefined {
  return MODULES.find((m) => m.id === id);
}

export function sortedModules(): ModuleDescriptor[] {
  return [...MODULES].sort((a, b) => a.order - b.order);
}

/**
 * Terminology per business type.
 *
 * Extends the existing `crmConfig.ts` idea (same property, different noun) to
 * the module axis: a landlord sees "Rent roll" where a cleaner sees "Jobs". The
 * module registry decides *what* is present; this decides what it is called.
 */
export interface ModuleTerminology {
  /** What the business calls its customers. */
  customers: string;
  /** What it calls the work it sells. */
  engagements: string;
  /** What it calls its team. */
  team: string;
}

const TERMINOLOGY: Record<string, ModuleTerminology> = {
  PROPERTY_MANAGEMENT: { customers: 'Tenants', engagements: 'Units', team: 'Maintenance crew' },
  SERVICE: { customers: 'Clients', engagements: 'Jobs', team: 'Providers' },
  SALES: { customers: 'Leads', engagements: 'Deals', team: 'Sales team' },
  FREELANCE: { customers: 'Clients', engagements: 'Projects', team: 'Collaborators' },
  GENERAL: { customers: 'Customers', engagements: 'Work', team: 'Team' },
};

export function terminologyFor(businessType?: string): ModuleTerminology {
  return (businessType && TERMINOLOGY[businessType]) || TERMINOLOGY.GENERAL;
}

/** Accent hex, resolved from the design-system palette. */
export function accentFor(id: ModuleId, palette: Record<string, string>): string {
  const module = moduleById(id);
  if (!module) return palette.textMuted;
  return palette[module.accent] || palette.textMuted;
}
