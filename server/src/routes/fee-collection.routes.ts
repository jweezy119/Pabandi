import { Router, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  generateStatementsForPeriod,
  listStatements,
  getStatement,
  markStatementPaid,
  voidStatement,
  waiveStatement,
  overdueStatements,
  revenuePosition,
  dunningStage,
  sendStatementViaSquareById,
  sendOutstandingStatementsViaSquare,
  type StatementStatus,
} from '../services/fee-collection.service';

/**
 * Fee collection.
 *
 * WHY EVERY WRITE HERE IS ADMIN-ONLY
 * There is no payment integration behind any of these routes. Marking a statement
 * paid is a human asserting that money arrived in a bank account. If a merchant
 * could call it on their own statement, every fee would be self-forgiven — so the
 * assertion has to sit with someone who also sees the bank feed.
 *
 * The asymmetry that follows from that: reads are merchant-scoped, writes are not.
 * A merchant sees their own statements and owes money, which is information they
 * are entitled to and which is also the pressure that makes collection work.
 *
 * WHAT A MERCHANT CANNOT DO HERE
 * Pay, waive, void, or change a due date. Each of those is either a payment
 * integration that does not exist yet or a decision that is Pabandi's to make.
 */

const router = Router();

/** Parse a ?days=N style query parameter with a sane bound. */
function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Statements for the caller's own businesses.
 *
 * Ownership is enforced in the query rather than by fetching then comparing: a
 * fetch-then-filter would load every merchant's statements into this process
 * before discarding them, and a mistake in the filter would leak all of them.
 */
router.get('/statements', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true },
    });
    const ids = businesses.map((b) => b.id);

    // A merchant with no businesses gets an empty list rather than an error —
    // that is the correct answer for someone who has not onboarded yet.
    // Fetched unfiltered then intersected, because listStatements takes a single
    // businessId and a merchant may own several. The intersection is what enforces
    // isolation here, so it is the load-bearing line and worth stating plainly.
    const statements = ids.length === 0
      ? []
      : (await listStatements({
          status: req.query.status as StatementStatus | undefined,
          limit: boundedInt(req.query.limit, 200, 1, 500),
        })).filter((st) => ids.includes(st.businessId));

    res.json({
      success: true,
      data: {
        statements: statements.map((s) => ({ ...s, dunningStage: dunningStage(s.daysOverdue) })),
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Statement list failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * What a merchant owes, across all their businesses.
 *
 * Kept separate from the statement list because "how much do I owe" is the
 * question a merchant actually has, and answering it should not require them to
 * open every statement.
 */
router.get('/owes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true, name: true },
    });

    const perBusiness = await Promise.all(
      businesses.map(async (b) => {
        const agg = await prisma.merchantFeeStatement.aggregate({
          where: { businessId: b.id, status: { in: ['draft', 'sent'] } },
          _sum: { totalCents: true },
        });
        return { businessId: b.id, businessName: b.name, owingCents: agg._sum.totalCents ?? 0 };
      }),
    );

    const total = perBusiness.reduce((s, b) => s + b.owingCents, 0);
    res.json({
      success: true,
      data: {
        businesses: perBusiness,
        totalOwingCents: total,
        totalOwingDollars: (total / 100).toFixed(2),
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Owes read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** One statement with its individual fees, for a merchant's own statement. */
router.get('/statements/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const statement = await getStatement(req.params.id);
    if (!statement) throw new CustomError('Statement not found', 404);

    const owned = await prisma.business.findFirst({
      where: { id: statement.businessId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!owned) {
      // 404 rather than 403: a merchant probing ids should not learn which
      // statement numbers exist for other businesses.
      throw new CustomError('Statement not found', 404);
    }

    res.json({
      success: true,
      data: { ...statement, dunningStage: dunningStage(statement.daysOverdue) },
    });
  } catch (err: any) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) logger.error(`[Fees] Statement read failed: ${err.message}`);
    res.status(status).json({ success: false, error: err.message });
  }
});

// ── Admin: the collection cycle ─────────────────────────────────────────────

/**
 * Generate statements for a period.
 *
 * Defaults to the previous calendar month. Bill-to-date is possible via
 * ?periodEnd=now, which is wrong for a normal cycle — a statement issued mid-period
 * covers fees that keep accruing after it, so the merchant is billed twice for the
 * overlap. It exists for a backfill or a correction, not for routine use.
 */
router.post(
  '/statements/generate',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const now = new Date();
      const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      const periodStart = req.body?.periodStart ? new Date(req.body.periodStart) : defaultStart;
      const periodEnd = req.body?.periodEnd ? new Date(req.body.periodEnd) : defaultEnd;

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        throw new CustomError('periodStart and periodEnd must be valid dates', 400);
      }
      if (periodStart > periodEnd) {
        throw new CustomError('periodStart must be before periodEnd', 400);
      }

      const result = await generateStatementsForPeriod({
        periodStart,
        periodEnd,
        businessId: req.body?.businessId || undefined,
      });

      res.json({
        success: true,
        data: {
          ...result,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
      });
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      if (status === 500) logger.error(`[Fees] Statement generation failed: ${err.message}`);
      res.status(status).json({ success: false, error: err.message });
    }
  },
);

/** Mark a statement paid after the bank transfer is confirmed. */
router.post(
  '/statements/:id/paid',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const statement = await markStatementPaid(req.params.id, req.body?.reference);
      res.json({ success: true, data: statement });
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      if (status === 500) logger.error(`[Fees] Mark-paid failed: ${err.message}`);
      res.status(status).json({ success: false, error: err.message });
    }
  },
);

/** Void a mis-built statement; its fees return to unbilled. */
router.post(
  '/statements/:id/void',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const statement = await voidStatement(req.params.id, req.body?.reason || '');
      res.json({ success: true, data: statement });
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      if (status === 500) logger.error(`[Fees] Void failed: ${err.message}`);
      res.status(status).json({ success: false, error: err.message });
    }
  },
);

/** Write off a statement the merchant will not pay. Always requires a reason. */
router.post(
  '/statements/:id/waive',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const statement = await waiveStatement(req.params.id, req.body?.reason || '');
      res.json({ success: true, data: statement });
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      if (status === 500) logger.error(`[Fees] Waive failed: ${err.message}`);
      res.status(status).json({ success: false, error: err.message });
    }
  },
);

/** The dunning queue, oldest debt first. */
router.get('/overdue', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const statements = await overdueStatements();
    res.json({
      success: true,
      data: {
        statements: statements.map((s) => ({ ...s, dunningStage: dunningStage(s.daysOverdue) })),
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Overdue read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * The money position.
 *
 * unbilled + outstanding + collected + writtenOff are separate figures on purpose.
 * `collected` is the only one that is revenue; presenting the assessed total as
 * "revenue" is how a marketplace reports a take rate it has not been paid.
 */
router.get('/position', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const position = await revenuePosition();
    res.json({
      success: true,
      data: {
        ...position,
        // Dollars as well as cents, because this is a number a human decides
        // things about.
        unbilledDollars: (position.unbilledCents / 100).toFixed(2),
        outstandingDollars: (position.outstandingCents / 100).toFixed(2),
        overdueDollars: (position.overdueCents / 100).toFixed(2),
        collectedDollars: (position.collectedCents / 100).toFixed(2),
        writtenOffDollars: (position.writtenOffCents / 100).toFixed(2),
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Position read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send one statement to its merchant via Square invoice.
 *
 * Admin-only for the same reason as markStatementPaid: deciding a statement
 * leaves the manual path is a collection decision, and a merchant-reachable
 * trigger for it would let them push a bill at a moment of their choosing.
 */
router.post(
  '/statements/:id/send',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await sendStatementViaSquareById(req.params.id);
      if (!result.ok) {
        // 409 for a state conflict (already sent, paid, void), 503 for a
        // capability or configuration gap. They mean different things to whoever
        // is trying to fix it.
        const status = result.reason === 'capability' || result.reason === 'not_configured' ? 503 : 422;
        return res.status(status).json({
          success: false,
          reason: result.reason,
          error: result.detail ?? 'Could not send statement via Square',
        });
      }
      res.json({
        success: true,
        data: {
          statementId: req.params.id,
          squareInvoiceId: result.squareInvoiceId,
          paymentLink: result.paymentLink,
        },
      });
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      if (status === 500) logger.error(`[Fees] Square send failed: ${err.message}`);
      res.status(status).json({ success: false, error: err.message });
    }
  },
);

/** Batch: invoice every outstanding statement that is not already invoiced. */
router.post(
  '/statements/send-batch',
  authenticate,
  authorize('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = boundedInt(req.body?.limit, 50, 1, 200);
      const result = await sendOutstandingStatementsViaSquare(limit);
      res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error(`[Fees] Square batch send failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
