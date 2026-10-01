import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { RAIL_IDS, RailId, isRailId } from './rail-router.service';

/**
 * Money Flow — the read model behind the ContactOS "Money Flow" tab.
 *
 * NAMING
 * This is deliberately NOT treasury.service.ts. That file already exists and
 * is the protocol treasury (buckets, LP provision, yield reinvest, tribute).
 * Five modules import it. Overwriting it with invoice analytics would have
 * broken the protocol treasury, so this lives alongside it as money-flow.
 *
 * WHY THIS EXISTS
 * A business can see individual invoices, but there is no view of the shape of
 * its money: what is coming, what landed, what is stuck, which rails carry the
 * volume and what they cost. Answering those today means exporting invoices
 * and doing arithmetic in a spreadsheet.
 *
 * Every figure is derived live from existing tables. No new model, no stored
 * aggregate: an aggregate that can disagree with the invoices it summarises is
 * worse than no aggregate, and invoice status changes constantly.
 *
 * RAIL ATTRIBUTION
 * An invoice does not record which rail settled it. We infer it two ways, in
 * order of confidence:
 *   1. A ReconciliationMatch row records the rail explicitly. Exact.
 *   2. The business's default payment method, for invoices with no match yet.
 *      A projection, not a fact, and flagged as such in the response.
 * Anything we cannot attribute is reported under `unattributed` rather than
 * spread across the rails, which would make every rail number a guess.
 */

/** Published card/PSP pricing, as basis points of the amount. */
export const RAIL_FEES: Record<RailId, { bps: number; label: string; note: string }> = {
  square: { bps: 290, label: 'Square', note: '2.9% + $0.30 per transaction' },
  paypal: { bps: 290, label: 'PayPal', note: '2.9% + fixed fee, varies by tier' },
  safepay: { bps: 250, label: 'SafePay', note: '2.5% local card processing' },
  solana: { bps: 25, label: 'Solana USDC', note: '~$0.25 network fee per transfer' },
  bank: { bps: 0, label: 'Bank transfer', note: 'No processing fee' },
};

export interface RailBreakdownRow {
  railId: string;
  label: string;
  /** Sum of invoice subtotals attributed to this rail. */
  amount: number;
  invoiceCount: number;
  feeBps: number;
  feeNote: string;
  /** amount * bps / 10000. A projection, not a settlement statement. */
  projectedFees: number;
  /** True when attribution came from a real reconciliation match. */
  measured: boolean;
}

export interface MoneyFlowSummary {
  businessId: string;
  currency: string;
  expectedIncoming: { total: number; overdue: number; dueThisWeek: number; dueLater: number };
  receivedThisWeek: { total: number; count: number };
  outstanding: { total: number; count: number; oldestDaysPastDue: number | null };
  byRail: RailBreakdownRow[];
  unattributed: { amount: number; invoiceCount: number };
  currencyExposure: { currency: string; receivable: number; received: number; net: number; invoiceCount: number }[];
  /** Total projected fees across all rails. */
  totalProjectedFees: number;
  /** Where each stat on the page links to. */
  links: Record<string, string>;
  generatedAt: string;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const PAID = ['paid'];
const AWAITING = ['sent', 'overdue', 'payment_claimed'];

function isPaid(status: string): boolean {
  return PAID.includes(status);
}

function isAwaiting(status: string): boolean {
  return AWAITING.includes(status);
}

/**
 * Currency for an invoice. Invoice has no currency column, so the business
 * currency applies, with the notes-envelope `currency` honoured when a caller
 * has set one there.
 */
function currencyOf(invoice: { notes: string | null }, fallback: string): string {
  if (!invoice.notes) return fallback;
  try {
    const parsed = JSON.parse(invoice.notes) as { metadata?: { currency?: string } };
    const c = parsed?.metadata?.currency;
    return typeof c === 'string' && c.length > 0 ? c.toUpperCase() : fallback;
  } catch {
    return fallback;
  }
}

/** Statuses are stored inconsistently cased across the codebase. */
function normStatus(status: string): string {
  return status.toLowerCase();
}

export async function getMoneyFlow(businessId: string): Promise<MoneyFlowSummary> {
  const [business, invoices, matches] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true, name: true } }),
    prisma.invoice.findMany({
      where: { businessId },
      select: { id: true, number: true, status: true, subtotal: true, dateDue: true, paidAt: true, notes: true },
    }),
    prisma.reconciliationMatch.findMany({
      where: { status: 'matched', invoice: { businessId } },
      select: { invoiceId: true, rail: true },
    }),
  ]);

  const baseCurrency = (business?.currency || 'USD').toUpperCase();
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Exact rail attribution. paymentRef is unique so a given payment matches
  // once, but repairing history could leave two rows; latest wins.
  const railByInvoice = new Map<string, string>();
  for (const m of matches) {
    if (m.invoiceId) railByInvoice.set(m.invoiceId, m.rail);
  }

  const defaultMethod = await prisma.businessPaymentMethod.findFirst({
    where: { businessId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { railId: true },
  });

  const expectedIncoming = { total: 0, overdue: 0, dueThisWeek: 0, dueLater: 0 };
  const receivedThisWeek = { total: 0, count: 0 };
  const outstanding = { total: 0, count: 0, oldestDaysPastDue: null as number | null };

  const railTotals = new Map<string, { amount: number; invoiceCount: number; measured: boolean }>();
  for (const id of RAIL_IDS) railTotals.set(id, { amount: 0, invoiceCount: 0, measured: false });
  const unattributed = { amount: 0, invoiceCount: 0 };

  const exposure = new Map<string, { receivable: number; received: number; net: number; invoiceCount: number }>();
  // One invoice can touch the same currency twice (received this week, and
  // also attributed elsewhere), so count distinct invoices rather than rows.
  const exposureCounted = new Set<string>();
  const touchExposure = (currency: string, invoiceId: string, field: 'receivable' | 'received', amount: number) => {
    const row = exposure.get(currency) ?? { receivable: 0, received: 0, net: 0, invoiceCount: 0 };
    row[field] += amount;
    row.net = round(row.received - row.receivable);
    if (!exposureCounted.has(`${currency}:${invoiceId}`)) {
      row.invoiceCount += 1;
      exposureCounted.add(`${currency}:${invoiceId}`);
    }
    exposure.set(currency, row);
  };

  for (const inv of invoices) {
    const status = normStatus(inv.status);
    const amount = Number(inv.subtotal ?? 0);
    const currency = currencyOf(inv, baseCurrency);

    if (isPaid(status)) {
      // "Received this week" means paid in the last 7 days, not all-time paid.
      if (inv.paidAt && inv.paidAt >= weekAgo && inv.paidAt <= now) {
        receivedThisWeek.total = round(receivedThisWeek.total + amount);
        receivedThisWeek.count += 1;
        touchExposure(currency, inv.id, 'received', amount);
      }
      continue;
    }

    if (!isAwaiting(status)) continue; // drafts are not money in motion

    outstanding.total = round(outstanding.total + amount);
    outstanding.count += 1;
    touchExposure(currency, inv.id, 'receivable', amount);

    expectedIncoming.total = round(expectedIncoming.total + amount);
    if (inv.dateDue < now) {
      expectedIncoming.overdue = round(expectedIncoming.overdue + amount);
      const daysPastDue = Math.floor((now.getTime() - inv.dateDue.getTime()) / (24 * 60 * 60 * 1000));
      if (outstanding.oldestDaysPastDue === null || daysPastDue > outstanding.oldestDaysPastDue) {
        outstanding.oldestDaysPastDue = daysPastDue;
      }
    } else if (inv.dateDue <= weekOut) {
      expectedIncoming.dueThisWeek = round(expectedIncoming.dueThisWeek + amount);
    } else {
      expectedIncoming.dueLater = round(expectedIncoming.dueLater + amount);
    }

    const attributedRail = railByInvoice.get(inv.id);
    if (attributedRail && isRailId(attributedRail)) {
      const row = railTotals.get(attributedRail)!;
      row.amount = round(row.amount + amount);
      row.invoiceCount += 1;
      row.measured = true;
    } else if (defaultMethod && isRailId(defaultMethod.railId)) {
      const row = railTotals.get(defaultMethod.railId)!;
      row.amount = round(row.amount + amount);
      row.invoiceCount += 1;
    } else {
      unattributed.amount = round(unattributed.amount + amount);
      unattributed.invoiceCount += 1;
    }
  }

  const byRail: RailBreakdownRow[] = Array.from(railTotals.entries())
    .filter(([, v]) => v.invoiceCount > 0)
    .map(([railId, v]) => {
      const fee = RAIL_FEES[railId as RailId];
      return {
        railId,
        label: fee?.label ?? railId,
        amount: v.amount,
        invoiceCount: v.invoiceCount,
        feeBps: fee?.bps ?? 0,
        feeNote: fee?.note ?? 'Unknown rail',
        projectedFees: round((v.amount * (fee?.bps ?? 0)) / 10000),
        measured: v.measured,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const currencyExposure = Array.from(exposure.entries())
    .map(([currency, v]) => ({
      currency,
      receivable: round(v.receivable),
      received: round(v.received),
      net: round(v.net),
      invoiceCount: v.invoiceCount,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const totalProjectedFees = round(byRail.reduce((sum, r) => sum + r.projectedFees, 0));

  logger.info(
    `[MoneyFlow] ${business?.name ?? businessId}: outstanding $${outstanding.total} over ${outstanding.count} invoice(s), received this week $${receivedThisWeek.total}, rails=[${byRail.map((r) => `${r.railId}:${r.amount}`).join(', ')}] unattributed=$${unattributed.amount}`,
  );

  return {
    businessId,
    currency: baseCurrency,
    expectedIncoming,
    receivedThisWeek,
    outstanding,
    byRail,
    unattributed,
    currencyExposure,
    totalProjectedFees,
    // The list page filters on one status at a time, so each stat links to the
    // status that best represents it.
    links: {
      expectedIncoming: '/contact/invoices?status=sent',
      overdue: '/contact/invoices?status=overdue',
      receivedThisWeek: '/contact/invoices?status=paid',
      outstanding: '/contact/invoices?status=sent',
    },
    generatedAt: now.toISOString(),
  };
}
