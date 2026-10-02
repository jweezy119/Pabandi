/**
 * Deposit policy — the pure pricing rules.
 *
 * Split from `deposit-policy.service.ts` so the band maths can be imported and
 * asserted without dragging in PrismaClient, which does not construct outside a
 * live environment. Same reasoning as `booking-escrow.rules.ts`: the logic that
 * decides what a customer pays should be readable and testable on its own.
 *
 * Nothing here touches the database. The quote returned by these functions is a
 * price, not a promise that the customer exists.
 */

/**
 * Deposit policy — trust bands decide the deposit, and the customer can see why.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This does not hold money. Deposits are collected by the merchant's own Square
 * account (see resolveSquareCredentials), so by the time a deposit is "funded"
 * the money has already reached the business. What the band adjusts is the
 * *amount asked for*, which is the part Pabandi can honestly influence: it is a
 * commitment device, not custody.
 *
 * WHY BAND-SCALED DEPOSITS
 * -------------------------
 * A flat deposit is a tax on the good customers. Someone with twelve completed
 * bookings and no no-shows faces the same ask as a first-timer, which is both
 * unfair and a reason to book off-platform. Scaling by band lets a business
 * charge less of people who have earned it, which is what makes the score worth
 * accumulating rather than a vanity badge.
 *
 * THE CONSTRAINT THAT MATTERS: TRANSPARENCY
 * ------------------------------------------
 * A customer quoted $0 for a haircut will assume the salon is cheap. So every
 * quote carries the full breakdown — base, band, multiplier, applied amount —
 * and the copy states that the reduction comes from their history, not from the
 * business's pricing. A discount nobody can explain reads as a bait-and-switch;
 * an explained one reads as loyalty.
 *
 * Because the breakdown is derived, it is also reproducible. Two customers with
 * the same band at the same business get the same number, which is what makes
 * "a salon charges me less than my friend" a checkable claim rather than a
 * complaint.
 */

/** Bands are ordered worst-to-best. The letter is the customer-facing label. */
export type TrustBand = 'D' | 'C' | 'B' | 'A';

/**
 * Passport scores are 0–1000 (see TrustPassport). Thresholds are set so a new
 * passport defaulting to 500 lands in C — the standard amount — rather than
 * being handed the free tier on day one with no history to justify it, and
 * rather than landing in B and being rewarded for a record they do not have yet.
 */
const BAND_THRESHOLDS: Array<{ band: TrustBand; min: number }> = [
  { band: 'A', min: 800 },
  { band: 'B', min: 600 },
  { band: 'C', min: 400 },
  { band: 'D', min: 0 },
];

/**
 * How much of the base deposit each band actually pays.
 *
 * Upper bound is 1.25, not 2.0 or more, and deliberately so: this scales the
 * *business's own* number. A business that sets an absurd base deposit should
 * not be able to lean on the band to double it into something punitive, because
 * the band is a statement about the customer, not about the price. Capping at
 * 1.25 keeps the penalty legible and small relative to the ask, which is what
 * makes it fair to someone with a genuinely bad record.
 */
const BAND_MULTIPLIER: Record<TrustBand, number> = {
  A: 0,
  B: 0.5,
  C: 1,
  D: 1.25,
};

/**
 * The hard ceiling on a deposit, as a fraction of the booking's value.
 *
 * The whitepaper promises a deposit is "never more than 50%" of the booking. Until
 * now nothing enforced that: the D-band multiplier of 1.25 only stays under the
 * ceiling while a business sets a base of 40% or less, so a single merchant
 * setting a 60% base silently broke a published customer protection.
 *
 * The band multiplier and this ceiling are different things and both are needed.
 * The multiplier is about the *customer* — how much extra to ask of someone with
 * a poor record. The ceiling is about the *merchant* — a floor under Pabandi's own
 * promise, regardless of who they are. Tightening the multiplier to make the
 * ceiling hold would penalise every honest D-band customer for a merchant's
 * misconfiguration, which is the wrong person to bill for it.
 *
 * Anchored to booking value, so it scales with the size of the transaction. It
 * only engages when the booking's value is known — see `applyBand`.
 */
export const DEPOSIT_CEILING_RATIO = 0.5;

/**
 * Whether a deposit can be quoted without the booking's value.
 *
 * A business using a flat `depositAmount` can be quoted before we know what the
 * booking costs, and the ceiling is defined against that cost. Inventing one would
 * either clamp nothing or clamp arbitrarily, so an unknown value leaves the quote
 * unclamped and flags it, rather than guessing.
 */
export function ceilingApplies(serviceValue: number | null | undefined): boolean {
  return Number.isFinite(Number(serviceValue)) && Number(serviceValue) > 0;
}

export function bandForScore(score: number): TrustBand {
  if (!Number.isFinite(score)) return 'C';
  for (const { band, min } of BAND_THRESHOLDS) {
    if (score >= min) return band;
  }
  return 'D';
}

export function multiplierForBand(band: TrustBand): number {
  return BAND_MULTIPLIER[band];
}

/**
 * The plain-language reason a deposit came out where it did.
 *
 * Kept next to the numbers on purpose. This string is what gets shown to the
 * customer, and it is also what support reads when someone disputes the
 * amount — so it must state the real reason and nothing else.
 */
export function bandExplanation(band: TrustBand): string {
  switch (band) {
    case 'A':
      return 'Your booking history is in our top tier, so no deposit is asked for. You can still book any available slot.';
    case 'B':
      return 'Your booking history qualifies you for a reduced deposit — half of the usual amount.';
    case 'C':
      return 'The standard deposit applies, which is based on this business\'s usual amount.';
    case 'D':
      return 'A slightly higher deposit applies while we build your booking history with us.';
  }
}

export interface DepositQuote {
  /** The business's own ask, before any band adjustment. */
  baseAmount: number;
  /** Multiplier applied to the base, 0–1.25. */
  multiplier: number;
  /** What the customer is actually asked to pay. */
  amount: number;
  currency: string;
  band: TrustBand | null;
  score: number | null;
  explanation: string;
  /** True when the band changed the number, so the UI can show the contrast. */
  adjusted: boolean;
  /** The amount a customer with no history would be asked for. */
  standardAmount: number;
  /** True when the 50% ceiling reduced the amount. */
  capped?: boolean;
  /** The ceiling that applied, in currency units. Null when unknowable. */
  ceilingAmount?: number | null;
  /** The band-scaled amount before the ceiling intervened. */
  uncappedAmount?: number;
}

/**
 * The band's effect, kept separate from any business lookup so it is testable
 * without a database and reusable for display alongside an existing booking.
 */
export function applyBand(
  baseAmount: number,
  band: TrustBand,
  score: number | null,
  currency = 'USD',
  serviceValue?: number | null,
): DepositQuote {
  const base = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;
  const multiplier = multiplierForBand(band);

  // Rounded to cents. A deposit is a cash figure; 0.0000001 rounding artefacts
  // show up on an invoice and read as a bug.
  const unrounded = base * multiplier;
  const amount = Math.round(unrounded * 100) / 100;

  // Clamp to the published ceiling. Only when the booking's value is known —
  // the ceiling is a fraction of it, so an unknown value means an unknowable cap.
  const clampable = ceilingApplies(serviceValue);
  const ceiling = clampable ? Math.round(Number(serviceValue) * DEPOSIT_CEILING_RATIO * 100) / 100 : null;
  const capped = clampable && amount > (ceiling as number);
  const finalAmount = capped ? (ceiling as number) : amount;

  return {
    baseAmount: Math.round(base * 100) / 100,
    multiplier,
    amount: finalAmount,
    currency,
    band,
    score,
    explanation: bandExplanation(band),
    adjusted: multiplier !== 1,
    standardAmount: Math.round(base * 100) / 100,
    capped,
    // The cap actually engaged, so support can explain the number instead of
    // guessing why it is lower than the band's arithmetic implies.
    ceilingAmount: ceiling,
    // What the band asked for before the ceiling intervened. Needed to show the
    // customer a real contrast — otherwise "capped" is unfalsifiable.
    uncappedAmount: amount,
  };
}

/**
 * A quote for a business with no band history at all — a customer with no
 * passport, or one the booking flow has not linked yet.
 *
 * This is band C rather than D on purpose. A first-time customer should pay the
 * standard ask, not a penalty: we have no evidence against them, and applying
 * 1.25x on absence of data would be treating "unknown" as "bad".
 */
export function quoteWithoutHistory(baseAmount: number, currency = 'USD'): DepositQuote {
  const base = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;
  return {
    baseAmount: Math.round(base * 100) / 100,
    multiplier: BAND_MULTIPLIER.C,
    amount: Math.round(base * 100) / 100,
    currency,
    band: null,
    score: null,
    explanation:
      'The standard deposit applies, which is based on this business\'s usual amount. It drops as your booking history with us grows.',
    adjusted: false,
    standardAmount: Math.round(base * 100) / 100,
  };
}
