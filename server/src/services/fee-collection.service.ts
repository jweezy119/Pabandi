/**
 * Fee collection — turning accrued fees into statements, and statements into cash.
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS
 * We cannot charge a merchant automatically. There is no Stripe Connect, and the
 * PayPal platform product — which is what "charge a connected seller" requires —
 * has not been approved. So collection is manual: a statement is produced, the
 * merchant pays by bank transfer, and an admin marks it settled.
 *
 * That is genuinely how accounts receivable works, and building it properly means
 * modelling it honestly: what is owed, what is overdue, what was written off, and
 * what has actually landed. The alternative — a "paid" flag anyone can flip — is
 * how revenue gets recognised for money that never arrived.
 *
 * IT DOES NOT SCALE, AND THE COST IS VISIBLE HERE
 * Manual collection is an email and a bank transfer per merchant per month. Past
 * roughly 50 merchants that is a person doing data entry. It is the right shape
 * for onboarding the first few dozen and the wrong shape for the next few
 * hundred, which is a real argument for wiring Stripe Connect when available. The
 * collection *records* here are the durable part; the manual payment step is the
 * part that should get automated.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * There is no self-serve payment endpoint. A reachable "mark this statement paid"
 * route would let any merchant void their own balance, and a payment endpoint
 * without a payment method behind it is a form that cannot succeed. Both belong
 * with the payment integration, not before it.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';

export type StatementStatus = 'draft' | 'sent' | 'paid' | 'void';

/** Days a merchant has to pay before the statement is overdue. */
export const PAYMENT_TERMS_DAYS = 14;

/** Ages at which an unpaid statement is chased. */
export const DUNNING_SCHEDULE_DAYS = [7, 14, 30];

export interface StatementSummary {
  id: string;
  number: string;
  businessId: string;
  status: StatementStatus;
  totalCents: number;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  feeCount: number;
  /** Days past due, or null when not yet due. Negative means not yet due. */
  daysOverdue: number | null;
}

/**
 * Statement numbers.
 *
 * FEES-<yearmonth>-<business id fragment>. Deliberately not sequential: two
 * concurrent statement runs would race on a counter, and a duplicated number on a
 * money document is a reconciliation problem for whoever has to read it. The
 * business fragment makes it unique without coordination and still tells a reader
 * whose statement it is.
 */
export function statementNumber(businessId: string, at: Date = new Date()): string {
  const ym = `${at.getUTCFullYear()}${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  return `FEES-${ym}-${businessId.slice(-6).toUpperCase()}`;
}

/**
 * Group a merchant's accrued fees into one statement.
 *
 * Wrapped in a transaction: the statement and the reassignment of its fees must
 * either both happen or neither, or fees would point at a statement that does not
 * exist — which reads as billed revenue that was never collected.
 *
 * Idempotent per business per period. A second run finds the unbilled fees gone
 * and creates nothing, which is what makes it safe to run from a cron that will
 * inevitably fire twice.
 */
export async function generateStatement(params: {
  businessId: string;
  periodStart: Date;
  periodEnd: Date;
  /** Overrides the calculated due date, e.g. to grant terms during onboarding. */
  dueAt?: Date;
}): Promise<StatementSummary | null> {
  const { businessId, periodStart, periodEnd } = params;

  const unbilled = await prisma.feeAssessment.findMany({
    where: {
      businessId,
      status: 'accrued',
      billedAt: null,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: { id: true, feeCents: true },
  });

  // Nothing accrued in this window. Returning null rather than a zero statement is
  // deliberate: merchants who had no billable activity should not receive an
  // invoice asking for nothing, which reads as a billing error and erodes trust.
  if (unbilled.length === 0) return null;

  const totalCents = unbilled.reduce((sum, f) => sum + f.feeCents, 0);
  const now = new Date();
  const dueAt = params.dueAt ?? new Date(now.getTime() + PAYMENT_TERMS_DAYS * 24 * 60 * 60 * 1000);

  const statement = await prisma.$transaction(async (tx) => {
    const created = await tx.merchantFeeStatement.create({
      data: {
        businessId,
        number: statementNumber(businessId, periodStart),
        periodStart,
        periodEnd,
        totalCents,
        status: 'draft',
        dueAt,
      },
    });

    await tx.feeAssessment.updateMany({
      where: { id: { in: unbilled.map((f) => f.id) } },
      data: { status: 'invoiced', billedAt: now, statementId: created.id },
    });

    return created;
  });

  logger.info(
    `[Fees] Statement ${statement.number} for business ${businessId}: ` +
      `${unbilled.length} fees totalling ${totalCents}c, due ${dueAt.toISOString().slice(0, 10)}.`,
  );

  return {
    id: statement.id,
    number: statement.number,
    businessId,
    status: statement.status as StatementStatus,
    totalCents,
    periodStart,
    periodEnd,
    dueAt: statement.dueAt,
    paidAt: statement.paidAt,
    feeCount: unbilled.length,
    daysOverdue: null,
  };
}

/**
 * Generate statements for every merchant with unbilled fees in the window.
 *
 * Returns a count and the failures rather than throwing: one business with a
 * bad row must not stop the other forty-nine from being billed.
 */
export async function generateStatementsForPeriod(params: {
  periodStart: Date;
  periodEnd: Date;
  /** Restrict to one business, for a manual re-run. */
  businessId?: string;
}): Promise<{ created: number; skipped: number; failed: Array<{ businessId: string; error: string }> }> {
  const businesses = await prisma.feeAssessment.findMany({
    where: {
      status: 'accrued',
      billedAt: null,
      createdAt: { gte: params.periodStart, lte: params.periodEnd },
      ...(params.businessId ? { businessId: params.businessId } : {}),
    },
    select: { businessId: true },
    distinct: ['businessId'],
  });

  let created = 0;
  let skipped = 0;
  const failed: Array<{ businessId: string; error: string }> = [];

  for (const { businessId } of businesses) {
    try {
      const statement = await generateStatement({
        businessId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      });
      if (statement) created++;
      else skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[Fees] Statement generation failed for ${businessId}: ${message}`);
      failed.push({ businessId, error: message });
    }
  }

  return { created, skipped, failed };
}

function daysOverdue(dueAt: Date | null, status: StatementStatus, now = new Date()): number | null {
  if (status === 'paid' || status === 'void') return null;
  if (!dueAt) return null;
  return Math.floor((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000));
}

async function withSummary(statement: {
  id: string; number: string; businessId: string; status: string; totalCents: number;
  periodStart: Date; periodEnd: Date; dueAt: Date | null; paidAt: Date | null;
  _count?: { assessments: number };
}): Promise<StatementSummary> {
  const status = statement.status as StatementStatus;
  return {
    id: statement.id,
    number: statement.number,
    businessId: statement.businessId,
    status,
    totalCents: statement.totalCents,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    dueAt: statement.dueAt,
    paidAt: statement.paidAt,
    feeCount: statement._count?.assessments ?? 0,
    daysOverdue: daysOverdue(statement.dueAt, status),
  };
}

/** One statement with the individual fees it covers. */
export async function getStatement(statementId: string) {
  const statement = await prisma.merchantFeeStatement.findUnique({
    where: { id: statementId },
    include: {
      assessments: {
        select: {
          id: true, sourceType: true, sourceId: true, chargeCents: true,
          feeCents: true, marginCents: true, rateBps: true, tier: true,
          category: true, currency: true, breakdown: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!statement) return null;
  return {
    ...(await withSummary({ ...statement, _count: { assessments: statement.assessments.length } })),
    fees: statement.assessments.map((f) => ({
      ...f,
      rate: f.rateBps / 10_000,
      ratePercent: (f.rateBps / 100).toFixed(2),
      applied: (f.breakdown as string[] | null) ?? [],
    })),
  };
}

export async function listStatements(params: {
  businessId?: string;
  status?: StatementStatus;
  limit?: number;
}): Promise<StatementSummary[]> {
  const rows = await prisma.merchantFeeStatement.findMany({
    where: {
      ...(params.businessId ? { businessId: params.businessId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    include: { _count: { select: { assessments: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(params.limit ?? 100, 500),
  });
  return Promise.all(rows.map((r) => withSummary(r)));
}

/**
 * Mark a statement paid.
 *
 * This asserts that money arrived. There is no integration behind it, so the
 * assertion is a human one and it must be admin-only — a merchant able to call
 * this on their own statement would simply be marking a debt as settled.
 *
 * Refuses a paid statement being re-marked, which would restamp paidAt and make
 * the collection timing unreportable.
 */
export async function markStatementPaid(
  statementId: string,
  reference?: string,
): Promise<StatementSummary> {
  const statement = await prisma.merchantFeeStatement.findUnique({
    where: { id: statementId },
    select: { id: true, status: true, paidAt: true },
  });
  if (!statement) throw new CustomError('Statement not found', 404);
  if (statement.status === 'paid') {
    throw new CustomError('Statement is already marked paid', 409);
  }
  if (statement.status === 'void') {
    throw new CustomError('Statement has been voided', 409);
  }

  const updated = await prisma.merchantFeeStatement.update({
    where: { id: statementId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      // The bank reference goes in the note rather than a dedicated column: it is
      // evidence for a human reconciling the bank feed, not something the system
      // queries on.
      ...(reference ? { note: `Paid. Reference: ${reference}` } : {}),
    },
    include: { _count: { select: { assessments: true } } },
  });

  logger.info(`[Fees] Statement ${updated.number} marked paid${reference ? ` (ref ${reference})` : ''}.`);
  return withSummary(updated);
}

/**
 * Void a statement and release its fees back to unbilled.
 *
 * The fees go back to `accrued` with `billedAt` cleared rather than being deleted,
 * because they describe real charges against real appointments. Voiding is for a
 * statement built on a mistake — a duplicated period, a miscategorised business —
 * not for forgiving a debt, which is `waiveStatement` and is deliberately a
 * separate, named act.
 */
export async function voidStatement(statementId: string, reason: string): Promise<StatementSummary> {
  if (!reason || reason.trim().length < 5) {
    throw new CustomError('A reason is required to void a statement', 400);
  }

  const statement = await prisma.merchantFeeStatement.findUnique({
    where: { id: statementId },
    select: { id: true, status: true },
  });
  if (!statement) throw new CustomError('Statement not found', 404);
  if (statement.status === 'paid') {
    // A paid statement is money that arrived. Voiding it would un-recognise
    // revenue without a refund actually being issued.
    throw new CustomError('Cannot void a paid statement; issue a refund instead', 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.feeAssessment.updateMany({
      where: { statementId },
      data: { status: 'accrued', billedAt: null, statementId: null },
    });
    return tx.merchantFeeStatement.update({
      where: { id: statementId },
      data: { status: 'void', note: `Voided: ${reason}` },
      include: { _count: { select: { assessments: true } } },
    });
  });

  logger.warn(`[Fees] Statement ${updated.number} voided (${reason}); its fees returned to unbilled.`);
  return withSummary(updated);
}

/**
 * Write off a fee the merchant will never pay.
 *
 * Separate from void because these are different decisions with different
 * consequences: void says "we should not have billed this", waive says "we are
 * choosing not to collect it". Collapsing them makes bad-debt look like an error
 * and hides a real problem with a merchant.
 *
 * Only ever called deliberately, and always with a reason.
 */
export async function waiveStatement(statementId: string, reason: string): Promise<StatementSummary> {
  if (!reason || reason.trim().length < 5) {
    throw new CustomError('A reason is required to waive a statement', 400);
  }

  const statement = await prisma.merchantFeeStatement.findUnique({
    where: { id: statementId },
    select: { id: true, status: true, number: true },
  });
  if (!statement) throw new CustomError('Statement not found', 404);
  if (statement.status === 'paid') {
    throw new CustomError('Cannot waive a paid statement', 409);
  }

  const updated = await prisma.merchantFeeStatement.update({
    where: { id: statementId },
    data: { status: 'void', note: `Waived as bad debt: ${reason}` },
    include: { _count: { select: { assessments: true } } },
  });

  await prisma.feeAssessment.updateMany({
    where: { statementId },
    // Waived, not deleted: the charge against the appointment still happened. This
    // status also excludes the fee from settledChargeCount, so it does not
    // consume one of the merchant's free transactions.
    data: { status: 'waived' },
  });

  logger.warn(`[Fees] Statement ${statement.number} waived as bad debt (${reason}).`);
  return withSummary(updated);
}

/** Overdue statements, oldest first — the dunning queue. */
export async function overdueStatements(now = new Date()): Promise<StatementSummary[]> {
  const rows = await prisma.merchantFeeStatement.findMany({
    where: { status: { in: ['draft', 'sent'] }, dueAt: { lt: now } },
    include: { _count: { select: { assessments: true } } },
    orderBy: { dueAt: 'asc' },
  });
  return Promise.all(rows.map((r) => withSummary(r)));
}

/**
 * How many times each overdue statement has been chased.
 *
 * Derived from the dunning schedule rather than a stored counter: whether a
 * statement has hit the 7-day mark is a function of its due date and today's date,
 * so storing a number invites the two to disagree.
 */
export function dunningStage(daysOverdueDays: number | null): number | null {
  if (daysOverdueDays === null) return null;
  const reached = DUNNING_SCHEDULE_DAYS.filter((d) => daysOverdueDays >= d);
  return reached.length > 0 ? Math.max(...reached) : null;
}

export interface RevenuePosition {
  /** Accrued but not yet on a statement. */
  unbilledCents: number;
  /** On statements, not yet paid. */
  outstandingCents: number;
  /** Of which overdue. */
  overdueCents: number;
  /** Settled. This is real revenue. */
  collectedCents: number;
  /** Written off. */
  writtenOffCents: number;
  statementsAwaitingPayment: number;
  businessesOwing: number;
}

/**
 * The money position, in the terms that matter.
 *
 * `collectedCents` is the only number that is revenue. The rest are either
 * receivables, bad debt, or a window on receivables. Presenting them in one
 * number — which "assessed fees" invites — is how a marketplace ends up reporting
 * a take rate it has not received.
 */
export async function revenuePosition(now = new Date()): Promise<RevenuePosition> {
  const [unbilled, outstanding, overdue, collected, waived] = await Promise.all([
    prisma.feeAssessment.aggregate({ where: { status: 'accrued' }, _sum: { feeCents: true } }),
    prisma.merchantFeeStatement.aggregate({
      where: { status: { in: ['draft', 'sent'] } },
      _sum: { totalCents: true },
    }),
    prisma.merchantFeeStatement.aggregate({
      where: { status: { in: ['draft', 'sent'] }, dueAt: { lt: now } },
      _sum: { totalCents: true },
    }),
    prisma.merchantFeeStatement.aggregate({ where: { status: 'paid' }, _sum: { totalCents: true } }),
    prisma.merchantFeeStatement.aggregate({ where: { status: 'void' }, _sum: { totalCents: true } }),
  ]);

  const businessesOwing = await prisma.merchantFeeStatement.groupBy({
    by: ['businessId'],
    where: { status: { in: ['draft', 'sent'] } },
  });

  const statementsAwaitingPayment = await prisma.merchantFeeStatement.count({
    where: { status: { in: ['draft', 'sent'] } },
  });

  return {
    unbilledCents: unbilled._sum.feeCents ?? 0,
    outstandingCents: outstanding._sum.totalCents ?? 0,
    overdueCents: overdue._sum.totalCents ?? 0,
    collectedCents: collected._sum.totalCents ?? 0,
    writtenOffCents: waived._sum.totalCents ?? 0,
    statementsAwaitingPayment,
    businessesOwing: businessesOwing.length,
  };
}
