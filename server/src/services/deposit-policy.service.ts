/**
 * Deposit policy — database lookups behind the pure pricing rules.
 *
 * The band arithmetic lives in `deposit-policy.rules.ts` and is imported here.
 * This file exists only to answer the two questions the rules cannot: what does
 * this business ask for, and what band does this customer hold.
 */

import { prisma } from '../utils/database';
import {
  applyBand,
  quoteWithoutHistory,
  bandForScore,
  isBlocked,
  bandExplanation,
  type TrustBand,
  type DepositQuote,
} from './deposit-policy.rules';
import { CustomError } from '../middleware/errorHandler';

export * from './deposit-policy.rules';

/**
 * The band's *own* score, not the blended overall figure.
 *
 * showUpScore is the relevant one for a deposit: a customer who has always
 * turned up is exactly who a deposit exists to stop disappearing. Blending in
 * payment or delivery history would let a strong score elsewhere paper over a
 * record of no-shows, which is the specific behaviour a deposit guards against.
 */
export async function bandForCrmClient(crmClientId: string): Promise<{
  band: TrustBand;
  score: number;
  sampleSize: number;
}> {
  const client = await prisma.crmClient.findUnique({
    where: { id: crmClientId },
    select: {
      passport: {
        select: { showUpScore: true, showUpSampleSize: true },
      },
    },
  });

  const score = client?.passport?.showUpScore ?? 500;
  return {
    band: bandForScore(score),
    score,
    sampleSize: client?.passport?.showUpSampleSize ?? 0,
  };
}

/**
 * Quote a deposit for a specific customer at a specific business.
 *
 * The business may set either a flat amount or a percentage of the service, and
 * both are honoured. Percentage is resolved against the service value the caller
 * passes in, so this stays a pure pricing function — it does not re-read the
 * service catalogue and cannot disagree with what the customer was quoted.
 */
export async function quoteDepositForClient(params: {
  businessId: string;
  crmClientId?: string | null;
  serviceValue?: number | null;
}): Promise<DepositQuote> {
  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: {
      currency: true,
      depositAmount: true,
      depositPercentage: true,
    },
  });

  const currency = business?.currency ?? 'USD';

  // Percentage takes precedence when both are set. A business that has migrated
  // from a flat ask to a proportional one is expressing that later intent, and
  // silently using the older field would under- or over-charge them.
  let base = 0;
  if (business?.depositPercentage && business.depositPercentage > 0) {
    const value = Number(params.serviceValue ?? 0);
    base = value > 0 ? (value * business.depositPercentage) / 100 : 0;
  } else if (business?.depositAmount && business.depositAmount > 0) {
    base = business.depositAmount;
  }

  if (base <= 0) {
    return quoteWithoutHistory(0, currency);
  }

  if (!params.crmClientId) {
    return quoteWithoutHistory(base, currency);
  }

  const { band, score } = await bandForCrmClient(params.crmClientId);

  // A band of E means the score could not be read. Pricing it anyway would hand
  // back an ordinary-looking quote for a customer whose history we do not have,
  // which is the failure mode the band exists to prevent. 422 rather than 400:
  // the request was well-formed, there is just nothing to price against yet.
  if (isBlocked(band)) {
    throw new CustomError(bandExplanation(band), 422);
  }

  // Pass the booking value so the 50% ceiling can be enforced. Omitting it here
  // would make the whitepaper's promise unenforceable on exactly the bookings
  // where it matters.
  return applyBand(base, band, score, currency, params.serviceValue);
}