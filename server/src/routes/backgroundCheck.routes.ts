import { Router, Request, Response } from 'express';
import { backgroundCheckService, CheckRequest } from '../services/backgroundCheck.service';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

/**
 * POST /api/v1/background-check
 * Streamlined single-subject screening. All fields optional except subjectType + subjectName.
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const body = req.body as CheckRequest;
    if (!body.subjectType || !body.subjectName) {
      return res.status(400).json({ success: false, error: 'subjectType and subjectName required' });
    }
    body.requestedBy = (req as any).userId;
    const id = await backgroundCheckService.createCheck(body);
    res.json({ success: true, data: { checkId: id, status: 'PENDING' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/v1/background-check/:id
 * Fetch full report (composite + per-module breakdown).
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const check = await backgroundCheckService.getCheck(req.params.id);
    if (!check) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, data: check });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/v1/background-check
 * List with optional filters: ?subjectType=FREELANCER&status=COMPLETE
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { subjectType, status, requestedBy } = req.query;
    const checks = await backgroundCheckService.listChecks({
      subjectType: subjectType as string,
      status: status as string,
      requestedBy: requestedBy as string,
    });
    res.json({ success: true, data: checks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/background-check/batch
 * Bulk screening for funnel automation.
 */
router.post('/batch', authenticate, async (req: Request, res: Response) => {
  try {
    const requests = (req.body.requests || []) as CheckRequest[];
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ success: false, error: 'requests[] required' });
    }
    const ids = await backgroundCheckService.batchScreen(requests);
    res.json({ success: true, data: { queued: ids.length, checkIds: ids } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/background-check/pre-booking
 * Hook for pre-transaction screening — called before a booking is finalized.
 * Auto-creates + runs, returns recommendation inline.
 */
router.post('/pre-booking', authenticate, async (req: Request, res: Response) => {
  try {
    const body = req.body as CheckRequest & { bookingId?: string };
    body.requestedBy = (req as any).userId;
    body.trigger = 'PRE_BOOKING';
    const id = await backgroundCheckService.createCheck(body);
    // Wait for completion (checks are fast; real sources ~2-4s)
    let check = await backgroundCheckService.getCheck(id);
    for (let i = 0; i < 20 && check?.status !== 'COMPLETE' && check?.status !== 'FAILED'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      check = await backgroundCheckService.getCheck(id);
    }
    res.json({
      success: true,
      data: {
        checkId: id,
        recommendation: check?.recommendation,
        riskScore: check?.riskScore,
        riskBand: check?.riskBand,
        proceed: check?.recommendation === 'PASS' || check?.recommendation === 'REVIEW',
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/background-check/recheck-due
 * Trigger recurring re-screening of stale checks (30d+).
 */
router.post('/recheck-due', authenticate, async (req: Request, res: Response) => {
  try {
    const n = await backgroundCheckService.recheckDue();
    res.json({ success: true, data: { requeued: n } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/background-check/migrate
 * Create BackgroundCheck table in production DB (Cloud Run FS is read-only, so raw SQL).
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "BackgroundCheck" ("id" TEXT NOT NULL PRIMARY KEY, "subjectType" TEXT NOT NULL, "subjectId" TEXT, "subjectName" TEXT NOT NULL, "subjectEmail" TEXT, "subjectPhone" TEXT, "subjectWallet" TEXT, "subjectGithub" TEXT, "subjectWebsite" TEXT, "subjectCompany" TEXT, "requestedBy" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "riskScore" INTEGER, "riskBand" TEXT, "recommendation" TEXT, "summary" TEXT, "githubResult" JSONB, "domainResult" JSONB, "newsResult" JSONB, "breachResult" JSONB, "sanctionsResult" JSONB, "registryResult" JSONB, "osintResult" JSONB, "trigger" TEXT NOT NULL DEFAULT 'MANUAL', "webhookUrl" TEXT, "pabFee" DOUBLE PRECISION NOT NULL DEFAULT 5, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3))`
    );
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BackgroundCheck_subjectType_idx" ON "BackgroundCheck"("subjectType")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BackgroundCheck_status_idx" ON "BackgroundCheck"("status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BackgroundCheck_requestedBy_idx" ON "BackgroundCheck"("requestedBy")`);
    // Self-healing: add any columns the schema gained after the table was first created.
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "walletResult" JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "gigHistoryResult" JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "temporalAlignment" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "aiRationale" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "identityConfidence" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "competenceConfidence" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BackgroundCheck" ADD COLUMN IF NOT EXISTS "integrityConfidence" INTEGER`);
    res.json({ success: true, message: 'BackgroundCheck table created/upgraded' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
