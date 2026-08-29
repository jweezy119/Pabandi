/**
 * Renter Equity service — makes rent a yield-bearing asset (Trust-As-Infrastructure).
 *
 * Design (mirrors pyd.service non-custodial principle):
 *   - Pabandi NEVER holds principal. Rent is notionally held in a yield-bearing
 *     RWA rail (Ondo USDY / Jito) for the float window (paid 1st, settles 5th).
 *   - Generated YIELD (not principal) is split 50/50 tenant / landlord.
 *   - Pabandi takes its spread FROM the yield, never from principal.
 *   - Until an on-chain RWA adapter is live, settlement is SIMULATED (flagged).
 *
 * Settlement is idempotent per RentStream row and is driven by the autonomous
 * heartbeat (monthly accrual) so it survives cold starts.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const PABANDI_YIELD_SPREAD_PCT = 1.0; // taken from yield, not principal

export interface RentStreamInput {
  tenantId: string;
  landlordId: string;
  rentAmountUSD: number;
  propertyId?: string;
  pool?: 'ONDO_USDC' | 'JITO_STSOL' | 'MAPLE';
  expectedApy?: number;
  holdingDays?: number;
}

function computeYieldSplit(rentAmountUSD: number, apyPct: number, holdingDays: number) {
  const totalYield = +(rentAmountUSD * (apyPct / 100) * (holdingDays / 365)).toFixed(6);
  const spread = +(totalYield * (PABANDI_YIELD_SPREAD_PCT / 100)).toFixed(6);
  const netYield = +(totalYield - spread).toFixed(6);
  const tenant = +(netYield / 2).toFixed(6);
  const landlord = +(netYield / 2).toFixed(6);
  return { totalYield, spread, netYield, tenant, landlord };
}

export class RenterEquityService {
  /** Create a rent stream (holds rent in yield rail for the float window). */
  async createRentStream(input: RentStreamInput) {
    const pool = input.pool || 'ONDO_USDC';
    const apy = input.expectedApy ?? (pool === 'ONDO_USDC' ? 4.5 : pool === 'JITO_STSOL' ? 7.0 : 6.0);
    const holdingDays = input.holdingDays ?? 4;
    const stream = await prisma.rentStream.create({
      data: {
        tenantId: input.tenantId,
        landlordId: input.landlordId,
        propertyId: input.propertyId,
        rentAmountUSD: input.rentAmountUSD,
        pool,
        expectedApy: apy,
        holdingDays,
        status: 'PENDING',
        simulated: !process.env.ONDO_RWA_LIVE, // SIMULATED until RWA adapter env set
      },
    });
    return { ok: true, stream };
  }

  /** Settle a single rent stream: compute + record 50/50 yield split. Idempotent. */
  async settleRentStream(streamId: string) {
    const stream = await prisma.rentStream.findUnique({ where: { id: streamId } });
    if (!stream) return { ok: false, error: 'not found' };
    if (stream.status === 'SETTLED') return { ok: true, settled: false, reason: 'already settled' };

    const { totalYield, spread, tenant, landlord } = computeYieldSplit(
      stream.rentAmountUSD,
      stream.expectedApy,
      stream.holdingDays
    );

    // When ONDO_RWA_LIVE: use the real USDY yield split (same 50/50 math, real APY source)
    // and perform the actual on-chain yield distribution from the settlement wallet.
    const { ondoUsdyService } = await import('./ondoUsdy.service');
    const usdySplit = ondoUsdyService.computeYieldSplit(stream.rentAmountUSD, stream.holdingDays);
    const finalTenant = usdySplit.tenantEquity;
    const finalLandlord = usdySplit.landlordBonus;
    const finalTotal = usdySplit.totalYield;
    const finalSpread = usdySplit.spread;

    // Real on-chain yield distribution (USDC from settlement wallet) when live.
    let onchain: any = { simulated: true };
    if (process.env.ONDO_RWA_LIVE === 'true') {
      try {
        onchain = await ondoUsdyService.settleYield(
          stream.id, stream.tenantId, stream.landlordId, stream.rentAmountUSD, stream.holdingDays
        );
      } catch (e: any) {
        logger.warn(`[RenterEquity] on-chain USDY settle skipped: ${e.message}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Credit tenant equity wallet
      await tx.renterEquityWallet.upsert({
        where: { userId: stream.tenantId },
        create: { userId: stream.tenantId, tenantEquity: finalTenant, totalSettled: finalTenant },
        update: { tenantEquity: { increment: finalTenant }, totalSettled: { increment: finalTenant } },
      });
      // Credit landlord bonus wallet
      await tx.renterEquityWallet.upsert({
        where: { userId: stream.landlordId },
        create: { userId: stream.landlordId, landlordBonus: finalLandlord, totalSettled: finalLandlord },
        update: { landlordBonus: { increment: finalLandlord }, totalSettled: { increment: finalLandlord } },
      });
      // Mark stream settled
      await tx.rentStream.update({
        where: { id: stream.id },
        data: {
          status: 'SETTLED',
          totalYieldUSD: finalTotal,
          tenantEquityUSD: finalTenant,
          landlordBonusUSD: finalLandlord,
          pabandiSpreadUSD: finalSpread,
          settledAt: new Date(),
        },
      });
    });

    // Issue a portable ZK Proof of Rent (amount + identity hidden) for the tenant.
    // This is the "rent is not a sunk cost + reliability is portable" primitive:
    // a third party can verify on-time payment without learning the rent amount.
    let porProofId: string | undefined;
    try {
      const { zkPorProver } = await import('./zkPorProver.service');
      const por = await zkPorProver.prove({
        months_paid: 1,
        graceDays: 5,
        issuedAt: Math.floor(Date.now() / 1000),
        tenant_secret: `${stream.tenantId}:por`,
        rent_amount: stream.rentAmountUSD,
        paid_ts: Math.floor(Date.now() / 1000) - stream.holdingDays * 86400,
        due_ts: Math.floor(Date.now() / 1000) - stream.holdingDays * 86400,
        salt: `${stream.id}:${stream.settledAt?.getTime() ?? Date.now()}`,
        // entityId is NOT a circuit input — it binds the resulting PTP attestation only.
        entityId: stream.tenantId,
        trustScore: 70,
      } as any);
      porProofId = por.proofId;
      logger.info(`[RenterEquity] Issued ZK Proof of Rent ${porProofId} for tenant ${stream.tenantId}`);
    } catch (e: any) {
      logger.warn(`[RenterEquity] PoR issuance skipped: ${e.message}`);
    }

    return {
      ok: true,
      settled: true,
      simulated: stream.simulated && onchain.simulated,
      totalYieldUSD: finalTotal,
      tenantEquityUSD: finalTenant,
      landlordBonusUSD: finalLandlord,
      pabandiSpreadUSD: finalSpread,
      onchain,
      porProofId,
    };
  }

  /** Settle all PENDING rent streams (called by heartbeat). Returns summary. */
  async settleAllPending() {
    const pending = await prisma.rentStream.findMany({ where: { status: 'PENDING' } });
    let settled = 0;
    let totalTenant = 0;
    let totalLandlord = 0;
    for (const s of pending) {
      const r = await this.settleRentStream(s.id);
      if (r.ok && (r as any).settled) {
        settled++;
        totalTenant += (r as any).tenantEquityUSD || 0;
        totalLandlord += (r as any).landlordBonusUSD || 0;
      }
    }
    if (settled > 0) {
      logger.info(`[RenterEquity] Settled ${settled} rent streams | tenant $${totalTenant.toFixed(4)} | landlord $${totalLandlord.toFixed(4)}`);
    }
    return { ok: true, settled, totalTenant, totalLandlord };
  }

  /** Get renter equity wallet for a user (public-friendly, no principal shown). */
  async getEquity(userId: string) {
    const w = await prisma.renterEquityWallet.findUnique({ where: { userId } });
    if (!w) return { userId, tenantEquity: 0, landlordBonus: 0, totalSettled: 0, exists: false };
    return {
      userId: w.userId,
      tenantEquity: w.tenantEquity,
      landlordBonus: w.landlordBonus,
      totalSettled: w.totalSettled,
      exists: true,
    };
  }
}

export const renterEquityService = new RenterEquityService();
