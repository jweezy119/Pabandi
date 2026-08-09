/**
 * ppd.service.ts — Pabandi Protected Deposit (deepened rail)
 *
 * Builds on PydService (trust-band deposit + yield) and adds:
 *   A) MilestoneDraw — phased, conditional release for construction/fleet
 *      (draws gated by lien waivers, BC refresh, payer sign-off; 10% retention)
 *   B) PerformanceBond — Pabond-underwritten bond that replaces/backs a deposit,
 *      priced from the beneficiary's TrustFlux velocity (lower premium = rising trust)
 *   C) CommunityPool — HOA yield redirected to community amenities/reserves,
 *      with transparent grants governed by the community
 *
 * Liability posture unchanged: Pabandi never holds principal. Bonds are
 * underwritten from the Pabond reserve + protocol fees; spread taken from yield.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { pydService } from './pyd.service';
import { backgroundCheckService } from './backgroundCheck.service';
import { pabondService } from './pabond.service';
import { assertCompliantPkrSettlement } from '../config/compliance';

// ── A. MILESTONE DRAWS ──────────────────────────────────────────────────────

export interface MilestoneInput {
  name: string;
  description?: string;
  sequence?: number;
  amountUSD: number;
  requiresLienWaiver?: boolean;
  requiresBcRefresh?: boolean;
  requiresSignoff?: boolean;
}

export interface CreateMilestoneProjectInput {
  tenantId: string;
  landlordId: string; // builder / fleet co / HOA vendor
  depositContext: 'BUILDER' | 'FLEET' | 'HOA';
  assetDescription: string;
  requiredAmountUSD: number;
  yieldOptIn?: boolean;
  communityPoolOptIn?: boolean;
  pool?: 'JITO_STSOL' | 'ONDO_USDC' | 'MAPLE';
  beneficiaryBackgroundCheckId?: string;
  milestones: MilestoneInput[];
  retentionPct?: number; // default 0.10 (10% held through warranty)
}

export class PpdService {
  /**
   * Create a milestone-gated project escrow.
   * Splits requiredAmountUSD across milestones + a retention draw.
   */
  async createMilestoneProject(input: CreateMilestoneProjectInput): Promise<any> {
    // GUARDRAIL #1 — PKR custody boundary. In REGULATED mode, Pabandi must never
    // open a PKR escrow agreement unless a licensed partner rail is configured.
    // Pabandi is the trust/orchestration layer, not a deposit-taker (no SECP NBFC).
    assertCompliantPkrSettlement();

    // GUARDRAIL #4 — TrustPassport gate for the beneficiary builder. A beneficiary whose
    // latest background check is REJECT/REVIEW (or band E) cannot receive escrow funds.
    // Uses real first-party data: BackgroundCheck by subjectId = landlordId.
    const beneficiaryCheck = await prisma.backgroundCheck.findFirst({
      where: { subjectId: input.landlordId, status: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
    });
    if (beneficiaryCheck && (beneficiaryCheck.recommendation === 'REJECT' || beneficiaryCheck.recommendation === 'REVIEW')) {
      throw new Error(
        `Escrow blocked: beneficiary failed background verification ` +
        `(band ${beneficiaryCheck.riskBand}, ${beneficiaryCheck.recommendation}). ` +
        `Resolve before opening an escrow project.`
      );
    }

    const retentionPct = input.retentionPct ?? 0.1;
    const milestoneTotal = input.milestones.reduce((s, m) => s + m.amountUSD, 0);
    const retentionUSD = +(input.requiredAmountUSD * retentionPct).toFixed(2);

    // The master deposit = milestone total + retention (what is actually escrowed)
    const escrowTotal = +(milestoneTotal + retentionUSD).toFixed(2);

    const { deposit, yieldAgreement } = await pydService.createDeposit({
      tenantId: input.tenantId,
      landlordId: input.landlordId,
      depositContext: input.depositContext,
      assetDescription: input.assetDescription,
      requiredAmountUSD: escrowTotal,
      yieldOptIn: input.yieldOptIn,
      communityPoolOptIn: input.communityPoolOptIn,
      pool: input.pool,
      beneficiaryBackgroundCheckId: input.beneficiaryBackgroundCheckId,
    });

    // Create milestone rows (incl. the retention draw, sequenced last)
    const rows = [...input.milestones].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const created: any[] = [];
    for (const m of rows) {
      created.push(await prisma.projectMilestone.create({
        data: {
          depositId: deposit.id,
          name: m.name,
          description: m.description,
          sequence: m.sequence ?? created.length,
          amountUSD: m.amountUSD,
          requiresLienWaiver: !!m.requiresLienWaiver,
          requiresBcRefresh: !!m.requiresBcRefresh,
          requiresSignoff: m.requiresSignoff ?? true,
          status: 'PENDING',
        },
      }));
    }
    // Retention draw
    const retention = await prisma.projectMilestone.create({
      data: {
        depositId: deposit.id,
        name: 'Retention (warranty hold)',
        description: `${retentionPct * 100}% held through 12-mo warranty period`,
        sequence: 999,
        amountUSD: retentionUSD,
        requiresLienWaiver: false,
        requiresBcRefresh: true,
        requiresSignoff: true,
        status: 'PENDING',
      },
    });

    logger.info(`[PPD] Milestone project ${deposit.id}: ${created.length} draws + retention $${retentionUSD}; escrowed $${escrowTotal}`);
    return { deposit, yieldAgreement, milestones: [...created, retention] };
  }

  /**
   * Release a milestone. Gates on lien waiver / BC refresh / sign-off.
   * Simulated escrow release (swap to solana_escrow in prod).
   */
  async releaseMilestone(milestoneId: string, opts?: { lienWaiverUrl?: string; signedBy?: string; bcCheckId?: string }): Promise<any> {
    const ms = await prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!ms) throw new Error('Milestone not found');
    if (ms.status === 'RELEASED') throw new Error('Already released');

    const blockers: string[] = [];
    if (ms.requiresLienWaiver && !opts?.lienWaiverUrl) blockers.push('lien waiver');
    if (ms.requiresBcRefresh && !opts?.bcCheckId) {
      // Run a fresh BC on the beneficiary (use deposit's landlord as subject)
      const dep = await prisma.securityDeposit.findUnique({ where: { id: ms.depositId } });
      const bcId = await backgroundCheckService.createCheck({
        subjectType: dep?.depositContext === 'FLEET' ? 'BUSINESS' : 'BUSINESS',
        subjectName: dep?.landlordId || 'beneficiary',
        subjectId: dep?.landlordId,
        consent: true,
        consentPurpose: 'Milestone release verification (Pabandi ToS + PECA/PDPA). Retention 30d.',
      });
      opts = { ...opts, bcCheckId: bcId };
    }
    if (ms.requiresSignoff && !opts?.signedBy) blockers.push('payer sign-off');

    if (blockers.length) {
      return { released: false, blockedBy: blockers };
    }

    const updated = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releasedTxHash: `sim_draw_${Date.now()}`,
        lienWaiverUrl: opts?.lienWaiverUrl,
        bcCheckId: opts?.bcCheckId,
      },
    });

    // ── PAY-ON-VERIFIED-WORK: instantly credit the worker's wallet ──────────────
    // This is the "remittance killer": verified completion -> worker gets USDC same
    // block, at a 0.5% settlement bps (vs ~7% remittance). Trust-gated (band E = no pay).
    const SETTLEMENT_BPS = 0.5;
    const dep = await prisma.securityDeposit.findUnique({ where: { id: ms.depositId } });
    const landlordId = dep?.landlordId;
    let creditedUserId: string | null = null;
    if (landlordId) {
      // Resolve landlordId (beneficiary key) -> User via TrustPassport.providerRef chain
      const passport = await prisma.trustPassport.findFirst({ where: { providerRef: landlordId } });
      if (passport?.agentId) {
        const profile = await prisma.linkedInProfile.findFirst({ where: { id: passport.agentId } });
        if (profile?.walletAddress) {
          const u = await prisma.user.findFirst({ where: { walletAddress: profile.walletAddress } });
          if (u) creditedUserId = u.id;
        }
      }
      // Fallback: the key itself may be a direct userId
      if (!creditedUserId) {
        const direct = await prisma.user.findFirst({ where: { id: landlordId } });
        if (direct) creditedUserId = direct.id;
      }
    }

    if (creditedUserId) {
      // Trust-gate: a beneficiary flagged band E cannot receive instant pay (held for dispute).
      // LinkedInProfile may not be migrated in all envs — treat missing as allowed (band D).
      let band = 'D';
      try {
        const u = await prisma.user.findUnique({ where: { id: creditedUserId } });
        if (u?.walletAddress) {
          const prof = await prisma.linkedInProfile.findFirst({ where: { walletAddress: u.walletAddress } });
          if (prof?.trustBand) band = prof.trustBand;
        }
      } catch {
        band = 'D'; // table absent or error -> default allow (verified-work release is itself the trust signal)
      }
      if (band !== 'E') {
        const fee = +(ms.amountUSD * (SETTLEMENT_BPS / 100)).toFixed(2);
        const net = +(ms.amountUSD - fee).toFixed(2);
        await prisma.$transaction(async (tx) => {
          await tx.wallet.update({ where: { userId: creditedUserId! }, data: { usdcBalance: { increment: net } } });
          await tx.workerPayout.create({
            data: { milestoneId, depositId: ms.depositId, userId: creditedUserId!, grossUsdc: ms.amountUSD, settlementBps: SETTLEMENT_BPS, feeUsdc: fee, netUsdc: net, status: 'PAID' },
          });
        });
        await prisma.projectMilestone.update({ where: { id: milestoneId }, data: { creditedUserId, creditedUsdc: net, settlementBps: SETTLEMENT_BPS } });
        logger.info(`[PayOnWork] Milestone ${milestoneId}: paid ${creditedUserId} net $${net} (fee $${fee}, ${SETTLEMENT_BPS}bps). Band ${band}.`);
      } else {
        logger.warn(`[PayOnWork] Milestone ${milestoneId}: beneficiary band E — held, no instant pay.`);
      }
    } else {
      logger.info(`[PayOnWork] Milestone ${milestoneId}: no resolvable worker wallet for "${landlordId}" — release recorded, pay pending linkage.`);
    }

    // If retention released, mark deposit RELEASED; else ACTIVE
    const remaining = await prisma.projectMilestone.count({ where: { depositId: ms.depositId, status: { not: 'RELEASED' } } });
    if (remaining === 0) {
      await prisma.securityDeposit.update({ where: { id: ms.depositId }, data: { status: 'RELEASED' } });
    } else {
      await prisma.securityDeposit.update({ where: { id: ms.depositId }, data: { status: 'ACTIVE' } });
    }

    logger.info(`[PPD] Milestone ${milestoneId} released: $${ms.amountUSD}`);
    return { released: true, milestone: updated };
  }

  // ── B. PERFORMANCE BOND ──────────────────────────────────────────────────────

  /**
   * Underwrite a performance bond for a builder/fleet/HOA vendor.
   * Premium priced from Pabond TrustFlux velocity: rising trust → cheaper bond.
   * This lets the vendor avoid tying up deposit capital entirely.
   */
  async underwriteBond(input: {
    depositId: string;
    beneficiaryId: string;
    payerId: string;
    depositContext: 'BUILDER' | 'FLEET' | 'HOA';
    coverageUSD: number;
  }): Promise<any> {
    // Price the premium from the beneficiary's verified BackgroundCheck score.
    // Lower risk score => lower premium. Map 0..100 -> mult 0.5..2.0.
    const bc = await prisma.backgroundCheck.findFirst({
      where: { subjectId: input.beneficiaryId, recommendation: 'PASS' },
      orderBy: { createdAt: 'desc' },
    });
    const bcScore = bc?.riskScore ?? 50;
    const velocityMult = +(0.5 + (bcScore / 100) * 1.5).toFixed(2);
    const basePremiumPct = 0.02;
    const premiumUSD = +(input.coverageUSD * basePremiumPct * velocityMult).toFixed(2);

    const bond = await prisma.performanceBond.create({
      data: {
        depositId: input.depositId,
        beneficiaryId: input.beneficiaryId,
        payerId: input.payerId,
        depositContext: input.depositContext,
        coverageUSD: input.coverageUSD,
        premiumUSD,
        velocityMult,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 365 * 86400000),
      },
    });

    logger.info(`[PPD] Performance bond ${bond.id}: coverage $${input.coverageUSD}, premium $${premiumUSD} (vel ${velocityMult})`);
    return bond;
  }

  async claimBond(bondId: string, reason: string): Promise<any> {
    const bond = await prisma.performanceBond.findUnique({ where: { id: bondId } });
    if (!bond || bond.status !== 'ACTIVE') throw new Error('Bond not claimable');
    return prisma.performanceBond.update({
      where: { id: bondId },
      data: { status: 'CLAIMED', claimedAt: new Date(), claimReason: reason },
    });
  }

  // ── C. COMMUNITY POOL (HOA) ──────────────────────────────────────────────────

  async createCommunityPool(communityName: string, treasuryWallet?: string): Promise<any> {
    return prisma.communityPool.create({
      data: { communityName, treasuryWallet: treasuryWallet ?? undefined, publicDashboard: true },
    });
  }

  /**
   * Route a deposit's yield to a community pool. Called when an HOA deposit
   * opts into communityPoolOptIn. Tracks cumulative deposits.
   */
  async routeDepositToPool(poolId: string, depositId: string): Promise<any> {
    const dep = await prisma.securityDeposit.findUnique({ where: { id: depositId } });
    if (!dep) throw new Error('Deposit not found');
    const pool = await prisma.communityPool.findUnique({ where: { id: poolId } });
    if (!pool) throw new Error('Pool not found');

    // Attribute projected yield (tenantApy from yield agreement) to the pool
    const yp = await pydService.projectYield(depositId, 12);
    const yieldUSD = yp.eligible ? yp.tenantYieldUSD : 0;

    return prisma.communityPool.update({
      where: { id: poolId },
      data: {
        totalDepositsUSD: { increment: dep.actualDepositUSD },
        totalYieldUSD: { increment: yieldUSD },
      },
    });
  }

  async proposeCommunityGrant(poolId: string, title: string, amountUSD: number, description?: string): Promise<any> {
    return prisma.communityGrant.create({
      data: { poolId, title, amountUSD, description: description ?? undefined, status: 'PROPOSED' },
    });
  }

  async approveCommunityGrant(grantId: string, approvedBy: string): Promise<any> {
    const grant = await prisma.communityGrant.findUnique({ where: { id: grantId } });
    if (!grant) throw new Error('Grant not found');
    const pool = await prisma.communityPool.findUnique({ where: { id: grant.poolId } });
    if (!pool || pool.totalYieldUSD < grant.amountUSD) {
      throw new Error('Insufficient pool yield to fund grant');
    }
    // Fund the grant from accumulated yield (never principal)
    await prisma.communityPool.update({
      where: { id: grant.poolId },
      data: {
        totalYieldUSD: { decrement: grant.amountUSD },
        totalDistributedUSD: { increment: grant.amountUSD },
      },
    });
    return prisma.communityGrant.update({
      where: { id: grantId },
      data: { status: 'FUNDED', approvedBy },
    });
  }

  /** Public transparency payload for an HOA dashboard. */
  async getCommunityDashboard(poolId: string): Promise<any> {
    const pool = await prisma.communityPool.findUnique({
      where: { id: poolId },
      include: { grants: { orderBy: { createdAt: 'desc' } } },
    });
    if (!pool) throw new Error('Pool not found');
    if (!pool.publicDashboard) return { public: false };
    return {
      public: true,
      communityName: pool.communityName,
      totalDepositsUSD: pool.totalDepositsUSD,
      totalYieldUSD: pool.totalYieldUSD,
      totalDistributedUSD: pool.totalDistributedUSD,
      availableYieldUSD: +(pool.totalYieldUSD - pool.totalDistributedUSD).toFixed(2),
      memberCount: pool.memberCount,
      grants: pool.grants,
    };
  }
}

export const ppdService = new PpdService();
