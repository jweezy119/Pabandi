/**
 * Per-rail COST MODEL and SETTLEMENT FINALITY.
 *
 * ─── WHAT THIS FILE IS FOR ──────────────────────────────────────────────────
 * `rail-router.service.ts` ranks rails by trust score and geography. Those are
 * the signals we trust. Cost is not: it is a TIEBREAKER, and only a tiebreaker.
 * This file is the arithmetic behind it — what a charge costs us on each rail,
 * and how final that settlement is once it lands.
 *
 * ─── WHY THIS ISN'T A SECOND FEE SCHEDULE ───────────────────────────────────
 * `config/fees.ts` already publishes what each rail costs us, in
 * `PUBLISHED_RAIL_FEES`. That file is emphatic that it is "published processor
 * rates, for reporting only. Never charged" — and it is currently the only place
 * those numbers live.
 *
 * So this file does not restate them freely. It adds the two things
 * `PUBLISHED_RAIL_FEES` cannot express — a FIXED fee per transaction, and a
 * settlement finality — and a test in
 * `services/__tests__/rail-router.test.ts` asserts that every percentage here
 * still agrees with `PUBLISHED_RAIL_FEES`. If a processor's rate moves, that
 * test fails and both tables are updated together.
 *
 * This matters more than usual here. `fees.ts` records that its own predecessor
 * had "six different rates for the same booking" and calls a merchant billed 5%
 * while their neighbour was billed 3% "a reason to leave, and it is
 * unanswerable because no two code paths agreed on what the fee was." Adding a
 * second cost table would recreate exactly that defect. The fixed fee and
 * finality columns have to live somewhere; the percentage must not.
 *
 * ─── WHAT THESE NUMBERS ARE NOT ─────────────────────────────────────────────
 * They are planning defaults, not a contract. They are:
 *
 *   - Not re-read at runtime. A real deployment should fetch live priority-fee
 *     data per quote; `SOLANA_NETWORK_FEE_USD` is a conservative stand-in for
 *     that, and the router will under- or over-price Solana on congested days.
 *   - Not merchant-facing. What a merchant is CHARGED is `quoteFee()` in
 *     `fees.ts`. This file only describes what the rail costs US, which is
 *     what makes a rail attractive to route to.
 *   - Not derived from `PROCESSOR` in `fees.ts`, which models Square alone
 *     (it backs the merchant fee's profitability floor). Routing needs the whole
 *     set.
 *
 * ─── WHY FINALITY IS HERE AND NOT IN THE ROUTER ──────────────────────────────
 * Because it is a property of the RAIL, not of the decision. A confirmed Solana
 * transfer cannot be clawed back; a card payment can be charged back for months
 * after the money is in the account. Anything that reports "paid" without
 * distinguishing those two is claiming a certainty it does not have — see
 * `settlementDecision()` in `auto-reconciliation.service.ts`, which is where
 * this gets applied.
 *
 * The distinction is not academic for the escrow path: releasing funds to a
 * seller on a card payment that is still chargebackable is releasing money the
 * platform may have to find again.
 */

/**
 * The rails this platform knows how to settle on.
 *
 * Declared here rather than in `rail-router.service.ts` so config files can
 * reference the union without importing the router, which imports them back.
 * `rail-router.service.ts` derives its own `RailId` from this list, so there is
 * still exactly one definition.
 */
export const RAIL_IDS = ['square', 'solana', 'paypal', 'safepay', 'bank'] as const;
export type Rail = (typeof RAIL_IDS)[number];

/**
 * How final a settled payment is.
 *
 * - `instant`    — confirmed and irreversible.
 * - `delayed`    — funds received, still inside the processor's chargeback
 *                  window. The money is real; the ability to take it back is
 *                  still live.
 * - `reversible` — can be recalled by the payer, on a notice period.
 */
export type Finality = 'instant' | 'delayed' | 'reversible';

export interface RailCost {
  rail: Rail;
  /** Percentage of the charge, as a fraction. 0.029 = 2.9%. */
  percentageFee: number;
  /** Fixed per-transaction charge, in USD. */
  fixedFee: number;
  /**
   * Network / priority fee, in USD. Non-zero only for on-chain rails.
   *
   * Solana's is variable and this is a placeholder — see the file header.
   */
  networkFee: number;
  finality: Finality;
  /**
   * Days after settlement during which the payment can still be reversed.
   * 0 for rails that cannot be reversed at all.
   */
  reversalWindowDays: number;
  /** True when settlement is on-chain. Drives which reconciliation path runs. */
  onChain: boolean;
}

/**
 * Solverana's cost is flat, not proportional — 5,000 lamports of base fee plus
 * whatever the priority fee market asks. Spelled as a flat dollar figure
 * because that is what it actually is; modelling it as a percentage is how a
 * "cheap rail" starts looking expensive on large tickets for no reason.
 */
const SOLANA_NETWORK_FEE_USD = 0.0025;

export const RAIL_COSTS: Record<Rail, RailCost> = {
  square: {
    rail: 'square',
    percentageFee: 0.029,
    fixedFee: 0.3,
    networkFee: 0,
    finality: 'delayed',
    reversalWindowDays: 120,
    onChain: false,
  },

  paypal: {
    rail: 'paypal',
    percentageFee: 0.029,
    fixedFee: 0.49,
    networkFee: 0,
    finality: 'delayed',
    reversalWindowDays: 180,
    onChain: false,
  },

  safepay: {
    rail: 'safepay',
    percentageFee: 0.025,
    fixedFee: 0,
    networkFee: 0,
    finality: 'delayed',
    reversalWindowDays: 30,
    onChain: false,
  },

  solana: {
    rail: 'solana',
    percentageFee: 0,
    fixedFee: 0,
    networkFee: SOLANA_NETWORK_FEE_USD,
    finality: 'instant',
    reversalWindowDays: 0,
    onChain: true,
  },

  bank: {
    rail: 'bank',
    percentageFee: 0,
    fixedFee: 0,
    networkFee: 0,
    finality: 'reversible',
    reversalWindowDays: 30,
    onChain: false,
  },
};

/**
 * Rails priced on a flat fee rather than a percentage.
 *
 * `PUBLISHED_RAIL_FEES` in fees.ts carries a nominal `bps` for Solana ("25") to
 * sort it against the percentage rails in reporting. That number is a label,
 * not an arithmetic rate, so the cross-check test does not treat it as one.
 */
export const FLAT_FEE_RAILS: ReadonlySet<Rail> = new Set<Rail>(['solana', 'bank']);

/** What this rail costs us, in USD, to collect `amountUsd` through it. */
export function estimateRailCost(rail: Rail, amountUsd: number): number {
  const c = RAIL_COSTS[rail];
  const amount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;
  return amount * c.percentageFee + c.fixedFee + c.networkFee;
}

/** Settlement finality for a rail. */
export function finalityFor(rail: Rail): Finality {
  return RAIL_COSTS[rail].finality;
}

/**
 * Days until this rail's settlement is truly final.
 *
 * Zero means it already is: an on-chain confirmation or a transfer that has
 * cleared. A non-zero value means the money is received but not yet safe to
 * treat as unconditionally the payer's.
 */
export function settlementWindowDays(rail: Rail): number {
  return RAIL_COSTS[rail].reversalWindowDays;
}

/** True when a settled payment on this rail cannot be taken back. */
export function isIrreversible(rail: Rail): boolean {
  return RAIL_COSTS[rail].reversalWindowDays === 0;
}

// ── Settlement decision ──────────────────────────────────────────────────────

export type SettlementStatus = 'settled' | 'pending' | 'reversible';

export interface SettlementDecision {
  status: SettlementStatus;
  /** When settlement stops being provisional. Null means it already is. */
  settlesAt: Date | null;
  /** Human-readable form of the same fact, for logs and for the UI. */
  explanation: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How final is a payment on this rail, right now?
 *
 * ─── WHY "PAID" IS NOT ENOUGH ───────────────────────────────────────────────
 * A payment being received and a payment being final are different claims, and
 * collapsing them is how an escrow gets released against money the platform
 * may have to go and find again. A card payment clears into the account
 * immediately and can be charged back for months afterwards; a confirmed
 * Solana transfer cannot be taken back at all.
 *
 * So `Invoice.status = 'paid'` stays as it was — the money did arrive, and
 * pretending otherwise would break the existing overdue sweep and every
 * invoice list. Finality is tracked alongside it on the ReconciliationMatch,
 * where the question "can this still be clawed back?" has a natural answer.
 *
 * ─── WHY THE REVERSIBLE/PENDING SPLIT EXISTS ────────────────────────────────
 * Both are "not final yet", but they are not the same promise. `pending` is a
 * queue that will end one way on its own. `reversible` is a right the payer
 * holds, exercisable at will until a notice period expires. Anything that
 * treats them identically will eventually hold escrow against funds that were
 * recallable the whole time.
 *
 * Deliberately pure and Prisma-free: it is a function of the finality table
 * above and nothing else, which is what makes it testable without a database
 * and impossible to drift from `RAIL_COSTS`.
 */
export function settlementDecision(rail: Rail, matchedAt: Date): SettlementDecision {
  const window = settlementWindowDays(rail);
  const railName = RAIL_COSTS[rail].rail;

  if (window === 0) {
    return {
      status: 'settled',
      settlesAt: null,
      explanation: `${railName} settles on-chain and cannot be reversed once confirmed.`,
    };
  }

  const settlesAt = new Date(matchedAt.getTime() + window * DAY_MS);
  const finality = finalityFor(rail);

  return {
    status: finality === 'reversible' ? 'reversible' : 'pending',
    settlesAt,
    explanation:
      `${railName} settled but can still be ${finality === 'reversible' ? 'recalled' : 'charged back'} ` +
      `for ${window} days. Final at ${settlesAt.toISOString()}.`,
  };
}