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
    const ev = await courtListenerService.lookupEvictions(cleanName, state);
    const riskBand: RiskBand = ev.recentEviction ? 'HIGH' : ev.found ? 'MEDIUM' : 'LOW';
    const result: CourtCheckResult = {
      subjectType,
      name: cleanName,
      state,
      found: ev.found,
      count: ev.count,
      recentEviction: ev.recentEviction,
      riskBand,
      reductionPct: BAND_REDUCTION[riskBand],
      cases: ev.cases,
    };

    const saved = await prisma.courtCheck.create({
      data: {
        subjectType,
        name: cleanName,
        state: state || null,
        found: ev.found,
        count: ev.count,
        recentEviction: ev.recentEviction,
        riskBand,
        cases: ev.cases as any,
        reservationId: reservationId || null,
        businessId: businessId || null,
        customerId: customerId || null,
      },
    });
    result.id = saved.id;
    logger.info(`[CourtCheck] ${subjectType} ${cleanName} (${state || 'ALL'}) -> ${riskBand} (reduction ${result.reductionPct})`);
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

  return { tenant, landlord };
}

export const courtCheckService = { screenParty, screenReservation, BAND_REDUCTION };
