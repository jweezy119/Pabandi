import { prisma } from '../../utils/database';
import { moduleRegistry } from '../contract';
import type {
  ModuleFacts,
  ModuleHealth,
  ModuleResult,
  ModuleScope,
  ModuleTimelineEntry,
  PabandiModule,
} from '../contract';

/**
 * Capital module
 *
 * Three distinct sources of capital with different semantics, kept in one
 * module because a business reads them as one question — "what can I deploy, and
 * what does it cost me":
 *
 *   • Mudarabah pools — equity offered to investors, business-scoped
 *   • Loans — the *owner's* personal borrowing capacity, user-scoped
 *   • Payouts — money leaving the platform
 *
 * Only Mudarabah carries a `businessId`. Loans are borrowed against a passport,
 * so they resolve through the owner. That asymmetry is precisely why capital
 * belongs behind an adapter instead of being queried ad hoc by the UI.
 */
export const capitalModule: PabandiModule = {
  id: 'capital',
  key: 'capital',
  label: 'Capital',
  blurb: 'Mudarabah pools, credit capacity, payouts and treasury',
  installable: true,
  requires: [],
  emits: ['capital.pool_funded', 'capital.loan_disbursed', 'capital.payout_settled'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const [pools, treasury] = await Promise.all([
      prisma.mudarabahPool.findMany({
        where: { businessId: scope.businessId },
        select: {
          id: true,
          title: true,
          targetAmount: true,
          currentAmount: true,
          expectedApy: true,
          status: true,
          riskBand: true,
          createdAt: true,
        },
      }),
      // Platform treasury positions are not business-scoped; surfaced as a
      // platform-level figure rather than attributed to this business.
      prisma.treasuryPosition.groupBy({
        by: ['bucket'],
        _sum: { amount: true },
      }),
    ]);

    const ownerId = await resolveOwnerId(scope.businessId);
    const loans = ownerId
      ? await prisma.loan.findMany({
          where: { userId: ownerId },
          select: { id: true, principalUsdc: true, status: true, band: true, dueDate: true },
        })
      : [];

    const payouts = ownerId
      ? await prisma.payout.findMany({
          where: {
            userId: ownerId,
            createdAt: { gte: scope.range.from, lte: scope.range.to },
          },
          select: { id: true, amountUsdc: true, feeUsdc: true, netUsdc: true, status: true, createdAt: true },
        })
      : [];

    if (pools.length === 0 && loans.length === 0 && payouts.length === 0) {
      return { status: 'empty', reason: 'No capital activity for this business' };
    }

    const raised = pools.reduce((s, p) => s + p.currentAmount, 0);
    const targeted = pools.reduce((s, p) => s + p.targetAmount, 0);
    const borrowed = loans
      .filter((l) => l.status === 'ACTIVE')
      .reduce((s, l) => s + l.principalUsdc, 0);
    const repaid = loans
      .filter((l) => l.status === 'REPAID')
      .reduce((s, l) => s + l.principalUsdc, 0);
    const settledOut = payouts
      .filter((p) => p.status === 'SETTLED')
      .reduce((s, p) => s + p.netUsdc, 0);

    const treasuryByBucket = Object.fromEntries(
      treasury.map((t) => [t.bucket, t._sum.amount ?? 0])
    );
    const treasuryTotal = Object.values(treasuryByBucket).reduce((a, b) => a + b, 0);

    return {
      status: 'ok',
      data: {
        counts: {
          openPools: pools.filter((p) => p.status === 'OPEN').length,
          activeLoans: loans.filter((l) => l.status === 'ACTIVE').length,
          payouts: payouts.length,
        },
        money: {
          // Capital raised is not revenue and must never be summed into it, so it
          // is reported under `cash` rather than `revenue`.
          cash: {
            gross: raised + borrowed,
            net: raised + borrowed - settledOut,
            outstanding: Math.max(0, targeted - raised),
            currency: 'USDC',
          },
        },
        series: [
          {
            key: 'capital_raised_by_bucket',
            points: Object.entries(treasuryByBucket).map(([bucket, v]) => ({
              t: bucket,
              v,
            })),
          },
        ],
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const [pools, investments] = await Promise.all([
      prisma.mudarabahPool.findMany({
        where: { businessId: scope.businessId, createdAt: { gte: scope.range.from } },
        select: { id: true, title: true, status: true, createdAt: true, currentAmount: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.mudarabahInvestment.findMany({
        where: { pool: { businessId: scope.businessId }, createdAt: { gte: scope.range.from } },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          status: true,
          pool: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const entries: ModuleTimelineEntry[] = [
      ...pools.map((p) => ({
        at: p.createdAt,
        moduleId: 'capital' as const,
        kind: 'capital.pool_opened',
        subject: { id: p.id, label: p.title },
        summary: `Opened pool "${p.title}" (${p.status.toLowerCase().replace(/_/g, ' ')})`,
      })),
      ...investments.map((i) => ({
        at: i.createdAt,
        moduleId: 'capital' as const,
        kind: 'capital.pool_funded',
        subject: { id: i.id, label: i.pool.title },
        summary: `Invested ${i.amount} USDC`,
        impact: { amount: i.amount, currency: 'USDC' },
      })),
    ];

    entries.sort((a, b) => b.at.getTime() - a.at.getTime());
    return { status: 'ok', data: entries };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.mudarabahPool.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

async function resolveOwnerId(businessId: string): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  return business?.ownerId ?? null;
}

/**
 * Trust module
 *
 * The trust protocol is not a report — it is a set of claims about the business,
 * each with a sample size. Exposing sample size alongside every score is
 * deliberate: a 900 payment score off 2 invoices must not read like a 900 off
 * 400. Any consumer is expected to render the denominator next to the number.
 */
export const trustModule: PabandiModule = {
  id: 'trust',
  key: 'trust',
  label: 'Trust',
  blurb: 'Passport scores, verification tier and fraud signals',
  installable: false,
  requires: [],
  emits: ['trust.score_changed', 'trust.fraud_flagged', 'trust.sealed'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const ownerId = await resolveOwnerId(scope.businessId);
    if (!ownerId) {
      return { status: 'unavailable', reason: 'Business has no owner to hold a passport' };
    }

    const passport = await prisma.trustPassport.findUnique({
      where: { userId: ownerId },
      select: {
        id: true,
        handle: true,
        score: true,
        level: true,
        verified: true,
        displayName: true,
        riskScore: true,
        riskBand: true,
        claimsCount: true,
        showUpScore: true,
        paymentScore: true,
        deliveryScore: true,
        tenancyScore: true,
        freightScore: true,
        showUpSampleSize: true,
        paymentSampleSize: true,
        deliverySampleSize: true,
        tenancySampleSize: true,
        freightSampleSize: true,
        verifiedIdentity: true,
        fraudFlag: true,
        escrowTheftFlag: true,
        chargebackFraudCount: true,
      },
    });

    if (!passport) {
      return { status: 'empty', reason: 'No trust passport issued for this owner yet' };
    }

    return {
      status: 'ok',
      data: {
        counts: {
          claims: passport.claimsCount,
          fraudFlags: (passport.fraudFlag ? 1 : 0) + passport.chargebackFraudCount,
          chargebackFraud: passport.chargebackFraudCount,
          // Scoped scores are 0-1000 with 500 as neutral. Reported as counts only
          // because they are ordinal, not additive.
          showUpScore: passport.showUpScore,
          paymentScore: passport.paymentScore,
          deliveryScore: passport.deliveryScore,
          tenancyScore: passport.tenancyScore,
          freightScore: passport.freightScore,
        },
        money: {},
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const ownerId = await resolveOwnerId(scope.businessId);
    if (!ownerId) {
      return { status: 'unavailable', reason: 'Business has no owner to hold a passport' };
    }

    // TrustAuditTrail is the hash-chained record of every score movement, so it
    // is the authoritative timeline for this layer — not a re-derivation.
    const trail = await prisma.trustAuditTrail.findMany({
      where: { userId: ownerId, createdAt: { gte: scope.range.from, lte: scope.range.to } },
      select: {
        id: true,
        previousScore: true,
        newScore: true,
        changeReason: true,
        component: true,
        severity: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      status: 'ok',
      data: trail.map((t) => ({
        at: t.createdAt,
        moduleId: 'trust',
        kind: `trust.${String(t.component).toLowerCase()}`,
        summary: t.changeReason,
        impact: { trustDelta: t.newScore - t.previousScore },
      })),
    };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.trustPassport.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

moduleRegistry.register(capitalModule);
moduleRegistry.register(trustModule);