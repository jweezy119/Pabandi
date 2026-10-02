import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { tokenomicsSummary, seedTokenomics } from '../config/pab-supply';

/**
 * Public tokenomics.
 *
 * WHY THIS IS UNAUTHENTICATED
 * "1,000,000,000 PAB, no further minting" is a promise, and a promise nobody can
 * check is not one. This endpoint returns the supply, the tranches, the emission
 * schedule, and whether they reconcile — so anyone can verify the arithmetic
 * rather than taking it on trust. It reads only derived and public figures, so
 * there is nothing here to leak.
 *
 * `reconciles` is computed on each call rather than asserted once at build time.
 * An endpoint that reports its own health is better than one that is quietly
 * unavailable when something drifts.
 */

const router = Router();

router.get('/summary', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await tokenomicsSummary() });
  } catch (err: any) {
    logger.error(`[Tokenomics] Summary failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Seed the allocation and treasury tables.
 *
 * Admin-only, and idempotent. Exposed as a route rather than run only at boot so
 * a fresh production database can be brought in line without a deploy — the
 * supply tables have to exist before the public summary can fall back to
 * anything but its compiled defaults.
 *
 * Safe to run repeatedly: every write is an upsert on the unique key, so a second
 * run corrects figures rather than creating a second definition of the supply.
 */
router.post('/seed', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    await seedTokenomics();
    res.json({ success: true, seeded: true, summary: await tokenomicsSummary() });
  } catch (err: any) {
    // A reconciliation failure here is the important case: it means the compiled
    // table is wrong, and the operator needs the message rather than a 500.
    logger.error(`[Tokenomics] Seed failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
