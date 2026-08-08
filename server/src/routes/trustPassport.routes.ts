/**
 * Trust Passport routes — public portable trust identity.
 *   GET  /api/v1/passport/:handle        -> public snapshot (no auth)
 *   POST /api/v1/passport                -> create/update (auth)
 *   GET  /api/v1/passport/:handle/request -> context for PPD wizard pre-fill
 *   POST /api/v1/passport/migrate        -> create table (Cloud Run FS read-only)
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { trustPassportService } from '../services/trustPassport.service';
import { prisma } from '../utils/database';

const router = Router();

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { handle, displayName, category, agentId, providerRef, bio, walletAddress } = req.body ?? {};
    if (!handle || !displayName) return res.status(400).json({ success: false, error: 'handle, displayName required' });
    const p = await trustPassportService.upsert({ handle, displayName, category, agentId, providerRef, bio, walletAddress });
    res.json({ success: true, data: p });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:handle', async (req: Request, res: Response) => {
  try {
    const snap = await trustPassportService.getPublic(req.params.handle);
    res.json({ success: true, data: snap });
  } catch (e: any) {
    res.status(404).json({ success: false, error: e.message });
  }
});

router.get('/:handle/request', async (req: Request, res: Response) => {
  try {
    const ctx = await trustPassportService.getRequestContext(req.params.handle);
    res.json({ success: true, data: ctx });
  } catch (e: any) {
    res.status(404).json({ success: false, error: e.message });
  }
});

router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS "TrustPassport" ("id" TEXT NOT NULL PRIMARY KEY, "handle" TEXT NOT NULL, "agentId" TEXT, "providerRef" TEXT, "category" TEXT NOT NULL DEFAULT 'FREELANCER', "displayName" TEXT NOT NULL, "bio" TEXT, "walletAddress" TEXT, "visibility" TEXT NOT NULL DEFAULT 'PUBLIC', "claimsCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "TrustPassport_handle_key" ON "TrustPassport"("handle")`,
      `CREATE INDEX IF NOT EXISTS "TrustPassport_agentId_idx" ON "TrustPassport"("agentId")`,
      `CREATE INDEX IF NOT EXISTS "TrustPassport_providerRef_idx" ON "TrustPassport"("providerRef")`,
    ];
    for (const s of stmts) await prisma.$executeRawUnsafe(s);
    res.json({ success: true, message: 'TrustPassport table migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
