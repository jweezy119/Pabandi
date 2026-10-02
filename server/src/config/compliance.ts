/**
 * Centralized Pakistan regulatory posture for Pabandi.
 *
 * Decisions (locked with founder, 2026):
 *  - PKR settlement runs through a LICENSED escrow/payment PARTNER (Safepay +
 *    SBP-approved bank escrow). Pabandi does NOT self-custody customer deposits,
 *    so it stays out of SECP NBFC licensing for v1.
 *  - $PAB is a TRADABLE utility token. That makes token issuance + on-chain escrow
 *    VASP activity under PVARA / Virtual Assets Act 2026, so the token entity must
 *    operate under a PVARA VASP license (or via a licensed VASP partner).
 *
 * This module is the single source of truth the app reads to stay compliant-by-design.
 * It does NOT invent licenses — it declares the *required* posture and exposes guards
 * the rest of the code calls.
 */

export type RegulationMode = 'OPEN' | 'REGULATED';

/**
 * Resolve the regulation mode.
 *
 * Previously this was `REGULATED_MODE === 'true' ? 'REGULATED' : 'OPEN'`, which
 * means the *unsafe* posture was the default: a deployment that simply forgot to
 * set the variable ran unverified crypto settlement and self-custody assumptions
 * while serving Pakistan, with nothing in the logs to say so.
 *
 * The default is now derived from the jurisdiction. Declaring PK (or any
 * regulated market) without explicitly opting out of regulation yields
 * REGULATED; an unrecognised jurisdiction also yields REGULATED, because the
 * cost of being wrong in the safe direction is a blocked feature and the cost
 * of being wrong in the other direction is a regulatory event.
 */
function resolveMode(): RegulationMode {
  const explicit = process.env.REGULATED_MODE;
  if (explicit === 'true') return 'REGULATED';
  if (explicit === 'false') return 'OPEN';

  const jurisdiction = (process.env.COMPLIANCE_JURISDICTION || 'PK').toUpperCase();
  const alwaysRegulated = new Set(['PK', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'MY', 'ID', 'NG', 'EG']);
  return alwaysRegulated.has(jurisdiction) ? 'REGULATED' : 'OPEN';
}

export const COMPLIANCE = {
  /** Master switch. In Pakistan this MUST be 'REGULATED'. 'OPEN' is dev/test only. */
  MODE: resolveMode() as RegulationMode,

  /** PKR never custodied by Pabandi — settled via a licensed partner rail. */
  SETTLEMENT_PARTNER: process.env.SETTLEMENT_PARTNER || 'safepay',

  /** $PAB is tradable; token activity requires a VASP license. */
  VASP_LICENSED: process.env.VASP_LICENSED === 'true',

  /** Jurisdiction this deployment serves (drives which policy set applies). */
  JURISDICTION: process.env.COMPLIANCE_JURISDICTION || 'PK',

  /** Disclosure string shown wherever $PAB is mentioned. */
  PAB_DISCLAIMER:
    '$PAB is a utility & incentive token, NOT an investment, security, or deposit. ' +
    'Value is not guaranteed. Use is governed by Pabandi Terms of Service.',

  /**
   * Booking escrow runs on the local fiat rail, never on-chain. Holding a
   * customer's PKR retainer through a licensed partner is both the regulatorily
   * clean path and the one that works: a salon customer paying via Raast does not
   * have, and should not need, a crypto wallet. See config/sharia.ts for why the
   * holding relationship is amanah rather than lending.
   */
  SERVICE_ESCROW_RAIL: process.env.SERVICE_ESCROW_RAIL || 'RAAST',
} as const;

export const isRegulated = (): boolean => COMPLIANCE.MODE === 'REGULATED';

/**
 * PKR must always settle through the licensed partner rail, never app-controlled.
 * Throws if the deployment is misconfigured (e.g. REGULATED mode but no partner).
 */
export const assertCompliantPkrSettlement = (): void => {
  if (isRegulated() && !COMPLIANCE.SETTLEMENT_PARTNER) {
    throw new Error('REGULATED_MODE requires SETTLEMENT_PARTNER (licensed PKR rail).');
  }
};

/**
 * $PAB transfer / on-chain escrow is VASP activity. In REGULATED mode it must only
 * proceed when the token entity is licensed (or routed via a licensed VASP partner).
 * Returns false (don't proceed) rather than throwing, so callers can fail gracefully.
 */
export const canMoveValueOnChain = (): boolean => {
  if (!isRegulated()) return true; // dev/test
  return COMPLIANCE.VASP_LICENSED;
};

export const pabDisclaimer = (): string => COMPLIANCE.PAB_DISCLAIMER;
