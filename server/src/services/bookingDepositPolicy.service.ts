/**
 * Booking deposit policy (DRPE) — pure functions.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * This lived inside `predictiveEngine.service.ts`, which is the Service
 * Coordinator's work-order risk engine: five features, an IRLS fit, and an
 * offline calibration script that rewrites the model file. Deposit policy is a
 * different question — it is a pricing rule about a booking, not a forecast
 * about a work order — and giving the coordinator's model file a second reason
 * to change makes its calibration output less stable for no benefit.
 *
 * Everything here is a function of plain numbers, so it is unit-testable
 * without a database. The route that calls it owns the two facts this module
 * cannot know: what the service actually costs, and whether the caller is
 * allowed to waive the deposit.
 */

export type ClientRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DrpeDepositDecision {
  /** Normalised 0–100 client Trust Score (70 = brand new default, 90+ = verified). */
  trustScore: number;
  /**
   * Descriptive tier. The deposit is a flat 20% for every sub-90 client by
   * design, so this drives the wording the merchant sees, not the amount.
   */
  riskLevel: ClientRiskLevel;
  /** 0 for verified clients (90+), 20 otherwise. */
  depositPercent: 0 | 20;
  depositAmount: number;
  serviceValue: number;
  /** Merchant-facing Coordinator banner, e.g. "Client Risk: LOW. Deposit Required: 0%." */
  merchantBanner: string;
  /** Plain-language explanation shown to the client before paying. */
  clientMessage: string;
}

/**
 * Normalises a Trust Score stored on either a 0–100 scale (the Prisma default)
 * or a 0–1000 scale onto a canonical 0–100 score.
 *
 * The two scales are genuinely ambiguous at the boundary: 101 is 10.1 on a
 * 0–1000 scale and an out-of-range 101 on a 0–100 one. Anything above 100 is
 * treated as the larger scale, which is the only reading that keeps the result
 * monotonic.
 */
export function normalizeTrustScore(raw?: number | null): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 70;
  const scaled = raw > 100 ? raw / 10 : raw;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/**
 * Evaluates the US DRPE deposit policy before checkout:
 * - Verified client (Trust Score >= 90): 0% deposit — book immediately, pay on completion.
 * - Otherwise: a 20% deposit, held in escrow.
 *
 * `serviceValue` must be the SERVER-SIDE price of the service. Passing a
 * client-supplied figure here lets the caller shrink its own deposit by
 * understating the value, so the booking route resolves it from the catalog
 * before calling in.
 */
export function evaluateBookingDepositPolicy(params: {
  trustScore?: number | null;
  serviceValue: number;
  predictedRiskScore?: number;
}): DrpeDepositDecision {
  const trustScore = normalizeTrustScore(params.trustScore);
  const serviceValue = Math.max(0, Number.isFinite(params.serviceValue) ? params.serviceValue : 0);

  if (trustScore >= 90) {
    return {
      trustScore,
      riskLevel: 'LOW',
      depositPercent: 0,
      depositAmount: 0,
      serviceValue,
      merchantBanner: 'Client Risk: LOW. Deposit Required: 0%.',
      clientMessage: 'Verified Trust Score (90+) — 0% deposit required. Book now and pay upon completion.',
    };
  }

  const riskLevel: ClientRiskLevel =
    trustScore < 50 || (typeof params.predictedRiskScore === 'number' && params.predictedRiskScore >= 0.7)
      ? 'HIGH'
      : 'MEDIUM';

  const depositPercent = 20 as const;
  const depositAmount =
    serviceValue > 0 ? Math.round(serviceValue * (depositPercent / 100) * 100) / 100 : 0;

  return {
    trustScore,
    riskLevel,
    depositPercent,
    depositAmount,
    serviceValue,
    merchantBanner: `Client Risk: ${riskLevel}. Deposit Required: ${depositPercent}%.`,
    clientMessage:
      'New or unverified profile — a refundable 20% deposit is required via Square or USDC escrow. Reach Trust Score 90+ to unlock 0% deposits.',
  };
}

/**
 * Turns a policy decision into the deposit actually charged.
 *
 * The client's own `depositAmount` is deliberately NOT an input. It used to be
 * the fallback, which meant a caller could send `serviceValue: 0` (or omit it)
 * and have its own `depositAmount: 0` honoured — a free booking regardless of
 * trust score. When a deposit is required it is either the computed percentage
 * of the real service value, or, if that value could not be established at all,
 * the merchant's own configured fixed deposit.
 */
export function resolveRequiredDeposit(params: {
  drpe: DrpeDepositDecision;
  /** The business's own `depositAmount`, used only when the service value is unknown. */
  businessDepositAmount?: number | null;
}): number {
  if (params.drpe.depositPercent === 0) return 0;
  if (params.drpe.depositAmount > 0) return params.drpe.depositAmount;

  const fallback = Number(params.businessDepositAmount);
  return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback * 100) / 100 : 0;
}
