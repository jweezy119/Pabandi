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
export type TrustBand = 'E' | 'D' | 'C' | 'B' | 'A';

/**
 * THE CANONICAL SCALE IS 0–100.
 *
 * These thresholds were previously 0–1000, matching the raw
 * `TrustPassport.showUpScore` column. That coupled a pricing policy to a storage
 * column: the band a customer landed in was decided by how wide a range that
 * column happened to use, so changing the column's range silently repriced every
 * deposit in the marketplace. The policy now takes the canonical 0–100 score and
 * converts at the boundary (`normalizeScore`), leaving the storage scale an
 * implementation detail.
 *
 *   A  70–100   no deposit
 *   B  40–69    reduced
 *   C  20–39    standard
 *   D   0–19    high
 *   E  invalid  blocked
 *
 * These are deliberately NOT PTP's bands (A >=85, B >=70, C >=50, D >=30, else
 * E). PTP bands carry fraud and no-show probabilities and feed attestation
 * signing; these decide what one customer is asked to put up at one business.
 * Reusing one set of letters for two different questions is how "band B" ends up
 * meaning two things on the same screen.
 *
 * A brand-new passport — 500 on the 0–1000 storage scale, i.e. 50 — lands in B:
 * a reduced deposit, not the standard ask, and still short of the free tier. It
 * is not rewarded for a record it does not have.
 */
const BAND_THRESHOLDS: Array<{ band: TrustBand; min: number }> = [
  { band: 'A', min: 70 },
  { band: 'B', min: 40 },
  { band: 'C', min: 20 },
  { band: 'D', min: 0 },
];

/**
 * How much of the base deposit each band actually pays.
 *
 * A pays nothing, B a reduced amount, C the standard ask, D a higher amount. E
 * never reaches pricing: it is refused upstream by `isBlocked`.
 *
 * The upper bound stays at 1.25 deliberately. This scales the *business's own*
 * number, and a business that sets an absurd base deposit should not be able to
 * lean on the band to inflate it into something punitive, because the band is a
 * statement about the customer, not about the price.
 */
const BAND_MULTIPLIER: Record<TrustBand, number> = {
  A: 0,
  B: 0.5,
  C: 1,
  D: 1.25,
  E: 1.25,
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

/**
 * The canonical score range is 0–100. `TrustPassport.showUpScore` is stored on
 * 0–1000, so this is the one place that knows both scales exist.
 *
 * Division by 10 is why the thresholds above are the canonical ones. It is a
 * named function rather than something inlined at the call site because two
 * scales for "trust score" in one codebase is exactly the ambiguity that
 * produced three parallel scoring systems in the first place: a caller that
 * passes a raw 0–1000 value straight to `bandForScore` lands in band A — the
 * free tier — for every real customer, and nothing complains.
 */
export function normalizeScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return Number.NaN;
  // Above the canonical ceiling means the 0–1000 storage scale; at or below it,
  // the value is already canonical. The overlap is unambiguous because 100 is
  // both "the best canonical score" and "one tenth of the storage scale".
  return rawScore > 100 ? rawScore / 10 : rawScore;
}

/**
 * E means "this cannot be priced", not "this customer is expensive".
 *
 * A missing, negative, NaN or non-numeric score used to fall through to band C —
 * the standard ask — so an unreadable score quietly produced an ordinary quote.
 * A deposit exists to hold a customer to a booking they might abandon, and an
 * unknown is not evidence of trustworthiness, so E refuses the quote instead of
 * pricing it.
 */
export function bandForScore(score: number): TrustBand {
  const normalized = normalizeScore(score);
  if (!Number.isFinite(normalized) || normalized < 0) return 'E';
  for (const { band, min } of BAND_THRESHOLDS) {
    if (normalized >= min) return band;
  }
  return 'E';
}

/** True when a score cannot be priced and the transaction must not proceed. */
export function isBlocked(band: TrustBand): boolean {
  return band === 'E';
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
    case 'E':
      // This string is shown to a customer, so it must not leak that we could not
      // read their score, and it must not read as an accusation either. "We cannot
      // confirm" is true, actionable, and does not invent a judgement.
      return 'We could not confirm your booking history, so this booking cannot be completed with a deposit quote right now. Please refresh and try again, or book without a deposit.';
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
