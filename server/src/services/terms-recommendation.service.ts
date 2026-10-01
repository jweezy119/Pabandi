import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { selectRail, recommendTerms, normalisePaymentScore, TermsRecommendation } from './rail-router.service';

/**
 * Trust-Adjusted Terms — recommend payment terms from the client's payment score.
 *
 * WHY THIS EXISTS
 * Terms are currently a constant: the create form always sets dateDue to the
 * end of the current month, for every client. A client who has paid on time
 * twenty times is quoted the same terms as one who has defaulted twice. The
 * trust data already exists on every passport; it just never reached the
 * invoice.
 *
 * The tiers come from the brief:
 *   >= 70  → offer net-30
 *   40–69  → immediate payment, standard rail
 *   < 40   → deposit required, escrow if available
 *
 * A recommendation is advice, not policy. The business can always override
 * it, and when they do the reason is written to the audit trail so that
 * "why did this client get net-60" is answerable months later.
 */

export { recommendTerms, normalisePaymentScore };
export type { TermsRecommendation };

export interface TermsRecommendationView {
  recommendation: TermsRecommendation;
  /** The due date the recommendation implies, as an ISO date. */
  suggestedDueDate: string;
  /** Rail the invoice would be routed to, when one can be determined. */
  railReasoning: string | null;
  clientCountry: string | null;
  /** True when the client has no linked passport, so the tier is a default. */
  defaulted: boolean;
}

/**
 * Build the terms recommendation for a client, plus the rail that would carry it.
 *
 * Returning both together is deliberate: terms and rail are the same decision
 * from two angles. Net-30 on a low-trust client and instant settlement on a
 * high-trust one are not independent choices, and showing one without the other
 * invites the business to pick terms that contradict the rail.
 */
export async function buildTermsRecommendation(
  businessId: string,
  clientId: string,
  opts: { amount?: number; currency?: string } = {},
): Promise<TermsRecommendationView | null> {
  const client = await prisma.crmClient.findUnique({
    where: { id: clientId },
    include: { passport: { select: { paymentScore: true, paymentSampleSize: true } } },
  });
  if (!client) return null;

  const paymentScore = normalisePaymentScore(client.passport?.paymentScore);
  const recommendation = recommendTerms(paymentScore);

  // These two lookups feed the rail preview only. Terms advice is worth
  // giving even when they fail, so each degrades to null rather than taking
  // the whole recommendation down with it.
  const [methods, business] = await Promise.all([
    prisma.businessPaymentMethod
      .findMany({ where: { businessId } })
      .catch((err) => {
        logger.warn(`[TermsRecommendation] payment methods lookup failed for ${businessId}: ${err}`);
        return [];
      }),
    prisma.business
      .findUnique({ where: { id: businessId }, select: { address: true, currency: true } })
      .catch(() => null),
  ]);

  // The rail router needs an Invoice-shaped object. The amount only affects
  // ticket-size affinity, so a preview with no amount is still meaningful.
  let railReasoning: string | null = null;
  let clientCountry: string | null = null;
  if (methods.length > 0) {
    try {
      const selection = selectRail(
        {
          id: '',
          number: 'PREVIEW',
          clientId: client.id,
          businessId,
          subtotal: opts.amount ?? 0,
        } as unknown as Parameters<typeof selectRail>[0],
        client,
        methods,
        { businessAddress: business?.address, passport: client.passport, currency: opts.currency ?? business?.currency },
      );
      railReasoning = selection.reasoning;
      clientCountry = selection.clientCountry;
    } catch (err) {
      logger.warn(`[TermsRecommendation] rail preview failed for client ${clientId}: ${err}`);
    }
  }

  const suggestedDueDate = new Date();
  suggestedDueDate.setDate(suggestedDueDate.getDate() + recommendation.dueInDays);

  return {
    recommendation,
    suggestedDueDate: suggestedDueDate.toISOString(),
    railReasoning,
    clientCountry,
    // A client with no passport has no payment history. Treating "unknown" as
    // a real 50 would let an unrated client quietly get standard terms.
    defaulted: !client.passport || client.passport.paymentSampleSize === 0,
  };
}

/** What the caller actually chose, for the audit record. */
export interface TermsDecision {
  terms: string;
  dueInDays: number;
  requireEscrow: boolean;
  /** Null when the business took the recommendation as-is. */
  overrideReason: string | null;
  recommended: TermsRecommendation;
}

export interface RecordTermsInput {
  businessId: string;
  invoiceId: string;
  clientId: string;
  decision: TermsDecision;
  actorId?: string;
  actorName?: string;
}

/**
 * Write the terms decision to the audit trail.
 *
 * The brief says to reuse the existing Activity or audit log. Two candidates
 * exist and this writes to both, for different readers:
 *  - SystemAuditLog is the general-purpose action log (actorId, action,
 *    targetId, metadata). It is the machine-readable record.
 *  - CrmActivity is the business-facing timeline a human actually reads on the
 *    client page. Without it the override is invisible in the product.
 *
 * These writes are deliberately not in a transaction with the invoice update.
 * An audit write failing must not roll back an invoice the business has
 * already sent to a client; a missing audit line is recoverable, an unsent
 * invoice is not.
 */
export async function recordTermsDecision(input: RecordTermsInput): Promise<void> {
  const { businessId, invoiceId, clientId, decision, actorId, actorName } = input;
  const overrode = decision.overrideReason !== null;

  const metadata = {
    recommendedTier: decision.recommended.tier,
    recommendedLabel: decision.recommended.label,
    recommendedDueInDays: decision.recommended.dueInDays,
    recommendedRequireEscrow: decision.recommended.requireEscrow,
    recommendedPaymentScore: decision.recommended.paymentScore,
    chosenTerms: decision.terms,
    chosenDueInDays: decision.dueInDays,
    chosenRequireEscrow: decision.requireEscrow,
    overrode,
    overrideReason: decision.overrideReason,
  };

  try {
    await prisma.systemAuditLog.create({
      data: {
        actorId: actorId ?? null,
        action: overrode ? 'INVOICE_TERMS_OVERRIDDEN' : 'INVOICE_TERMS_ACCEPTED',
        targetId: invoiceId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    logger.error(`[TermsDecision] system audit write failed for ${invoiceId}: ${err}`);
  }

  try {
    await prisma.crmActivity.create({
      data: {
        businessId,
        clientId,
        type: 'NOTE',
        title: overrode
          ? `Terms overridden on invoice: ${decision.terms}`
          : `Terms set by trust score: ${decision.terms}`,
        description: overrode
          ? `Recommended ${decision.recommended.label} (payment score ${decision.recommended.paymentScore}). Overridden: ${decision.overrideReason}`
          : `Recommended and accepted ${decision.recommended.label} based on payment score ${decision.recommended.paymentScore}.`,
        completed: true,
        status: 'DONE',
        priority: overrode ? 'MEDIUM' : 'LOW',
        ...(actorName ? { authorName: actorName } : {}),
      },
    });
  } catch (err) {
    logger.error(`[TermsDecision] CRM activity write failed for ${invoiceId}: ${err}`);
  }

  logger.info(
    `[TermsDecision] ${invoiceId}: ${overrode ? 'override' : 'accept'} → ${decision.terms} (recommended ${decision.recommended.tier}, score ${decision.recommended.paymentScore})${overrode ? ` — reason: ${decision.overrideReason}` : ''}`,
  );
}
