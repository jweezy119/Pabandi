/**
 * Trust Passport routes — public portable trust identity.
 *   GET  /api/v1/trust-passport/directory -> public discovery list (no auth)
 *   GET  /api/v1/trust-passport/:handle    -> public snapshot (no auth)
 *   POST /api/v1/trust-passport           -> create/update (auth)
 *   GET  /api/v1/trust-passport/:handle/request -> context for PPD wizard pre-fill
 *   POST /api/v1/trust-passport/migrate    -> create table (Cloud Run FS read-only)
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { trustPassportService } from '../services/trustPassport.service';
import { prisma } from '../utils/database';

const router = Router();

router.get('/directory', async (req: Request, res: Response) => {
  try {
    const list = await trustPassportService.list({
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json({ success: true, data: list, count: list.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

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

/* ROUTE ORDER IS LOAD-BEARING HERE.
 *
 * `/:handle` is a public passport lookup, and it was declared BEFORE `/me` and
 * `/user/:userId`. Express matches in declaration order, so `/api/v1/trust-passport/me`
 * was captured as a passport whose handle is literally "me": getPublic('me') threw and the
 * caller got a 404 -- even though a correct, authenticated `/me` handler existed twenty
 * lines below it and had never been reachable.
 *
 * Every literal path must be declared before `/:handle`. Adding one below it will look
 * correct and 404, which is exactly what happened here.
 */

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    let passport = await prisma.trustPassport.findFirst({ where: { userId } });
    if (!passport) {
      const handle = `user-${userId.slice(0, 8)}`;
      passport = await prisma.trustPassport.create({
        data: {
          userId,
          handle,
          displayName: (req as any).user?.firstName || 'User',
          visibility: 'PRIVATE',
        },
      });

router.get('/user/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const passport = await prisma.trustPassport.findFirst({ where: { userId: targetUserId } });
    if (!passport) return res.status(404).json({ success: false, error: 'Passport not found' });
    if (passport.visibility === 'PRIVATE') {
      return res.status(403).json({ success: false, error: 'Passport is private' });
    }
    res.json({ success: true, data: passport });
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

    }
    res.json({ success: true, data: passport });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/privacy', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { visibility, privacySettings } = req.body ?? {};
    const passport = await prisma.trustPassport.findFirst({ where: { userId } });
    if (!passport) return res.status(404).json({ success: false, error: 'Passport not found' });
    const updated = await prisma.trustPassport.update({
      where: { id: passport.id },
      data: { visibility, privacySettings },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
