import { prisma } from '../utils/database';
import { courtListenerService } from './osint/courtListener.service';
import { logger } from '../utils/logger';

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

// Maps a CourtListener eviction/litigation finding to a rental risk band and the
// corresponding SecurityDeposit reduction (mirrors the A–E PTP band logic already
// used elsewhere: a worse band => larger deposit to protect the counterparty).
const BAND_REDUCTION: Record<RiskBand, number> = {
  LOW: 0, // clean record — no extra deposit
  MEDIUM: 0.1, // some housing/litigation history — +10% deposit
  HIGH: 0.25, // recent eviction — +25% deposit
};

export interface CourtCheckResult {
  id?: string;
  subjectType: 'TENANT' | 'LANDLORD';
  name: string;
  state?: string;
  found: boolean;
  count: number;
  recentEviction: boolean;
  riskBand: RiskBand;
  reductionPct: number;
  cases: any[];
}

/**
 * Run a CourtListener eviction/litigation screen, persist the result to CourtCheck,
 * and return the structured finding. Safe to call fire-and-forget from booking flows.
 */
export async function screenParty(params: {
  subjectType: 'TENANT' | 'LANDLORD';
  name: string;
  state?: string;
  reservationId?: string;
  businessId?: string;
  customerId?: string;
}): Promise<CourtCheckResult> {
  const { subjectType, name, state, reservationId, businessId, customerId } = params;
  const cleanName = (name || '').trim();
  const fallback: CourtCheckResult = {
    subjectType,
    name: cleanName,
    state,
    found: false,
    count: 0,
    recentEviction: false,
    riskBand: 'LOW',
    reductionPct: 0,
    cases: [],
  };

  if (cleanName.length < 2) return fallback;

  const hasKey = !!process.env.COURTLISTENER_API_KEY || !!process.env.COURTLISTENER_API_KEYS;
  if (!hasKey) {
    logger.warn('[CourtCheck] skipping — COURTLISTENER_API_KEY not set');
    return fallback;
  }

  try {
    const comprehensive = await courtListenerService.comprehensiveCheck(cleanName, { state });
    const riskBand: RiskBand = comprehensive.riskBand;
    const result: CourtCheckResult = {
      subjectType,
      name: cleanName,
      state,
      found: comprehensive.totalCases > 0,
      count: comprehensive.totalCases,
      recentEviction: comprehensive.recentEviction,
      riskBand,
      reductionPct: BAND_REDUCTION[riskBand],
      cases: comprehensive.cases,
    };

    const saved = await prisma.courtCheck.create({
      data: {
        subjectType,
        name: cleanName,
        state: state || null,
        found: comprehensive.totalCases > 0,
        count: comprehensive.totalCases,
        recentEviction: comprehensive.recentEviction,
        riskBand,
        cases: comprehensive.cases as any,
        reservationId: reservationId || null,
        businessId: businessId || null,
        customerId: customerId || null,
      },
    });
    result.id = saved.id;
    logger.info(`[CourtCheck] ${subjectType} ${cleanName} (${state || 'ALL'}) -> ${riskBand} (${comprehensive.totalCases} cases, ${comprehensive.criminalCount} criminal)`);
    return result;
  } catch (e: any) {
    logger.error(`[CourtCheck] failed for ${cleanName}: ${e.message}`);
    return fallback;
  }
}

/**
 * Screen both parties of a reservation and return their bands + a combined
 * deposit adjustment suggestion. Fire-and-forget safe.
 */
export async function screenReservation(reservationId: string): Promise<{
  tenant?: CourtCheckResult;
  landlord?: CourtCheckResult;
}> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { business: true, customer: true },
  });
  if (!reservation) return {};

  const [tenant, landlord] = await Promise.all([
    screenParty({
      subjectType: 'TENANT',
      name: reservation.customerName || reservation.customer?.firstName + ' ' + reservation.customer?.lastName,
      state: reservation.business?.state || undefined,
      reservationId,
      customerId: reservation.customerId,
    }),
    screenParty({
      subjectType: 'LANDLORD',
      name: reservation.business?.name || '',
      state: reservation.business?.state || undefined,
      reservationId,
      businessId: reservation.businessId,
    }),
  ]);

  // Fold the screening outcome into the reservation's trust rail so the booking
  // detail / risk UI reflects court + PK screening without a separate lookup.
  // Also adjust the held deposit upward for elevated risk (never invents a deposit
  // where none exists) and record the original so the change is transparent.
  try {
    const bands = [tenant?.riskBand, landlord?.riskBand].filter(Boolean) as RiskBand[];
    const combined: RiskBand = bands.includes('HIGH') ? 'HIGH' : bands.includes('MEDIUM') ? 'MEDIUM' : 'LOW';
    const depositAdjPct = combined === 'HIGH' ? 0.25 : combined === 'MEDIUM' ? 0.1 : 0;

    const updateData: any = {
      trustSignals: {
        ...(reservation.trustSignals as any || {}),
        courtScreen: {
          tenantBand: tenant?.riskBand || 'LOW',
          landlordBand: landlord?.riskBand || 'LOW',
          combined,
          depositAdjPct,
          screenedAt: new Date().toISOString(),
        },
      },
    };

    // Apply the risk surcharge to an already-required deposit (protects hosts from no-shows).
    if (depositAdjPct > 0 && reservation.depositRequired && reservation.depositAmount) {
      const original = reservation.depositAmount;
      const adjusted = Math.round(original * (1 + depositAdjPct) * 100) / 100;
      updateData.depositAmount = adjusted;
      (updateData.trustSignals as any).courtScreen.depositOriginal = original;
      (updateData.trustSignals as any).courtScreen.depositAdjusted = adjusted;
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
    });
  } catch (e: any) {
    logger.warn(`[CourtCheck] failed to persist trustSignals for ${reservationId}: ${e.message}`);
  }

  return { tenant, landlord };
}

export const courtCheckService = { screenParty, screenReservation, BAND_REDUCTION };
