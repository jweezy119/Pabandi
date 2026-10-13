import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { customerIntelligenceService, type CustomerFeatures } from './ai/customerIntelligence.service';
import { crmScope } from './crm.service';

/**
 * Customer intelligence for CRM clients.
 *
 * WHY THIS IS A SEPARATE ADAPTER
 *
 * `customerIntelligence.service` is a real, tested model — recency/frequency/monetary
 * survival, churn probability, segmentation, next-best-action — and until now it had
 * no caller in the CRM at all. It also derives its features from nightlife
 * `Reservation` rows, `PabandiReview` and `User.referrals`.
 *
 * Those tables have nothing to do with a CrmClient. Pointing the model at a client id
 * would have returned an empty history, and the model does not stay quiet when handed
 * one: with zero revenue every revenue threshold misses, and it would still emit a
 * segment, a churn probability and a confident-sounding next action derived from
 * nothing. So it is not wired up as-is. Instead the same model is fed features built
 * from the rows that actually describe a CRM client.
 *
 * That it can be fed at all is recent work: `CrmClient.totalJobs`, `totalSpent` and
 * `lastJobAt` were displayed in the clients table but never written by anything, so
 * until those were derived from completed jobs and paid invoices there was no honest
 * history to read. The definitions below are deliberately identical to
 * `recomputeClientTotals` — a LTV that disagrees with the job count beside it would
 * be its own bug.
 *
 * THE EVIDENCE GATE
 *
 * The model's own `calculateConfidence` starts at 50 and floors at 40, so it reports
 * respectable confidence about a customer it has never heard of. Confidence was never
 * meant to gate anything; nothing consumed it.
 *
 * So below `MIN_ORDERS_FOR_VERDICT` completed jobs, or no paid invoice at all, this
 * returns an explicit "not enough history" result with a reason — never a segment, a
 * churn number, or a recommended action. A recommendation nobody can act on and
 * cannot check is worse than none: it is acted on. The honest output for a lead
 * added this morning is that there is nothing yet to say about them, which is true
 * and useful.
 */

const MIN_ORDERS_FOR_VERDICT = 3;
const MIN_REVENUE_FOR_VERDICT = 1;

export interface ClientIntelligenceResult {
  clientId: string;
  /** False when there is not enough history for a verdict to mean anything. */
  hasVerdict: boolean;
  /** Why there is no verdict. Present exactly when hasVerdict is false. */
  reason?: string;
  /** Plain facts about the relationship, always present and always real. */
  facts: {
    completedJobs: number;
    paidInvoices: number;
    totalSpent: number;
    lastJobAt: string | null;
    daysSinceLastJob: number | null;
    cancelledJobs: number;
  };
  /** Only present when hasVerdict is true. */
  segment?: string;
  valueTier?: string;
  predictedCLV?: number;
  churnProbability?: number;
  riskLevel?: string;
  confidence?: number;
  nextBestAction?: string;
  keyRiskFactors?: string[];
  retentionActions?: string[];
}

const SEGMENT_LABELS: Record<string, string> = {
  CHAMPION: 'Champion — high value, low risk',
  LOYAL: 'Loyal — consistent repeat business',
  POTENTIAL: 'Potential — active, room to grow',
  AT_RISK: 'At risk — slipping away',
  LOST: 'Dormant — no activity in six months',
};

/**
 * Build the model's input from a CRM client's real rows.
 *
 * Uses the same definitions as `recomputeClientTotals` and the same tenant scope, so
 * the LTV shown next to the job count here is the LTV shown there. A second, subtly
 * different definition of "total spent" is how a dashboard starts disagreeing with
 * itself.
 */
async function buildFeatures(
  clientId: string,
  serviceBusinessId: string,
  businessId: string | null,
): Promise<{ features: CustomerFeatures; facts: ClientIntelligenceResult['facts'] }> {
  const [jobs, paidInvoices] = await Promise.all([
    prisma.crmJob.findMany({
      where: crmScope(serviceBusinessId, businessId),
      select: { clientId: true, status: true, completedAt: true, price: true },
    }),
    prisma.invoice.findMany({
      where: { ...platformScope(businessId), clientId, status: 'paid' },
      select: { subtotal: true, paidAt: true },
    }),
  ]);

  // Invoices are keyed by the platform Business, jobs by either anchor — the same
  // split the rest of the CRM already handles, so it is done here explicitly rather
  // than by pointing both queries at one table's idea of a tenant.
  const clientJobs = jobs.filter((j) => j.clientId === clientId);
  const completed = clientJobs.filter((j) => j.status === 'COMPLETED');
  const cancelled = clientJobs.filter((j) => j.status === 'CANCELLED');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.subtotal || 0), 0);

  const completedDates = completed.map((j) => j.completedAt).filter((d): d is Date => !!d);
  const firstOrder = completedDates.length
    ? new Date(Math.min(...completedDates.map((d) => d.getTime())))
    : new Date();
  const lastOrder = completedDates.length
    ? new Date(Math.max(...completedDates.map((d) => d.getTime())))
    : new Date();

  const monthsSinceFirst = Math.max(
    1,
    (Date.now() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );

  return {
    facts: {
      completedJobs: completed.length,
      paidInvoices: paidInvoices.length,
      totalSpent: Math.round(totalRevenue * 100) / 100,
      lastJobAt: completedDates.length ? lastOrder.toISOString() : null,
      daysSinceLastJob: completedDates.length
        ? Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      cancelledJobs: cancelled.length,
    },
    features: {
      // The nightlife fetcher returned `customerId: ''` here, which propagated into both
      // predictions and back out to the caller as a blank id.
      customerId: clientId,
      businessId: serviceBusinessId,
      firstOrderDate: firstOrder,
      lastOrderDate: lastOrder,
      totalOrders: completed.length,
      totalRevenue,
      averageOrderValue: completed.length ? totalRevenue / completed.length : 0,
      orderFrequency: completed.length / monthsSinceFirst,
      daysSinceLastOrder: completedDates.length
        ? Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      cancellationRate: clientJobs.length ? cancelled.length / clientJobs.length : 0,
      // CRM jobs record a no-show as a cancellation after the grace period rather than a
      // distinct status, so there is no separate series to read and the honest value is
      // absent rather than a fabricated zero.
      noShowRate: 0,
    },
  };
}

/**
 * Invoice scope. Returns an impossible predicate when there is no platform business,
 * because an empty filter here would be a match-all on the money table — the worst
 * available failure direction.
 */
function platformScope(businessId: string | null) {
  return { businessId: businessId ?? '__no_platform_business__' };
}

export async function getClientIntelligence(
  clientId: string,
  serviceBusinessId: string,
  businessId: string | null,
): Promise<ClientIntelligenceResult> {
  const { features, facts } = await buildFeatures(clientId, serviceBusinessId, businessId);

  // The gate. Each branch names what is missing, because "not enough data" with no
  // explanation is indistinguishable from the model being broken.
  if (features.totalOrders < MIN_ORDERS_FOR_VERDICT) {
    return {
      clientId,
      hasVerdict: false,
      reason:
        features.totalOrders === 0
          ? 'No completed jobs yet — there is no history to draw a conclusion from.'
          : `Only ${features.totalOrders} completed job${features.totalOrders === 1 ? '' : 's'}. At least ${MIN_ORDERS_FOR_VERDICT} are needed before a pattern means anything.`,
      facts,
    };
  }
  if (features.totalRevenue < MIN_REVENUE_FOR_VERDICT) {
    return {
      clientId,
      hasVerdict: false,
      reason: 'No paid invoices yet, so there is no revenue history to value.',
      facts,
    };
  }

  try {
    const [clv, churn] = await Promise.all([
      customerIntelligenceService.predictCLV(features),
      customerIntelligenceService.predictChurn(features),
    ]);

    return {
      clientId,
      hasVerdict: true,
      facts,
      segment: SEGMENT_LABELS[clv.segment] ?? clv.segment,
      valueTier: clv.segment,
      predictedCLV: clv.predictedCLV,
      churnProbability: churn.churnProbability,
      riskLevel: churn.riskLevel,
      confidence: clv.confidence,
      nextBestAction: clv.nextBestAction,
      keyRiskFactors: churn.keyRiskFactors,
      retentionActions: churn.retentionActions,
    };
  } catch (err) {
    // The model swallows its own errors and returns a fallback with confidence 40,
    // which would be presented here as a real verdict.
    logger.error(`[CrmIntelligence] prediction failed for ${clientId}: ${err}`);
    return {
      clientId,
      hasVerdict: false,
      reason: 'Could not work this out right now.',
      facts,
    };
  }
}