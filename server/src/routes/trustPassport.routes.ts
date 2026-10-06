/**
 * Trust Passport routes — public portable trust identity.
 *   GET  /api/v1/trust-passport/directory       -> public discovery list (no auth)
 *   POST /api/v1/trust-passport                -> create/update (auth)
 *   GET  /api/v1/trust-passport/me             -> caller's own passport (auth)
 *   GET  /api/v1/trust-passport/user/:userId   -> passport by user (auth)
 *   PUT  /api/v1/trust-passport/privacy        -> set visibility (auth)
 *   GET  /api/v1/trust-passport/:handle/request-> PPD wizard pre-fill (no auth)
 *   GET  /api/v1/trust-passport/:handle        -> public snapshot (no auth)
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

/* ROUTE ORDER IS LOAD-BEARING HERE. `/:handle` is a catch-all for a single path
 * segment, so it must be declared LAST. Every literal path (`/directory`, `/me`,
 * `/privacy`) has to come before it or Express will never reach it.
 *
 * This file previously had `/user/:userId`, `/:handle` and `/:handle/request`
 * nested inside the `/me` handler's `try` block. Express builds its route table
 * when this module is evaluated, so those three were never registered at all:
 *
 *   - GET /api/v1/trust-passport/:handle           404 (the public lookup an agent
 *                                                  calls to read a reputation)
 *   - GET /api/v1/trust-passport/:handle/request   404
 *   - GET /api/v1/trust-passport/user/:userId      404
 *   - GET /api/v1/trust-passport/me                hung to timeout: the handler
 *                                                  ran the nested registrations,
 *                                                  fell out of the try without
 *                                                  ever calling res.json, so the
 *                                                  response never ended.
 *
 * All four have live callers in client/src/services/api.ts, and two of those are
 * `/me` on the personal dashboard and passport pages. tests/trust-passport-routes.test.ts
 * now walks the Express route table and fails if this regresses, because a route
 * that is merely *written down* in the right order is not the same as one that is
 * *registered*.
 */

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    // userId is @unique on TrustPassport, so findUnique is the correct lookup —
    // findFirst happened to work only because no duplicate rows existed yet.
    let passport = await prisma.trustPassport.findUnique({ where: { userId } });

    if (!passport) {
      // The full userId, not a slice of it. `handle` is @unique, and a truncated
      // cuid prefix collides in principle; a 404 on the client's second load is
      // not worth saving eight characters.
      try {
        passport = await prisma.trustPassport.create({
          data: {
            userId,
            handle: `user-${userId}`,
            displayName: (req as any).user?.firstName || 'User',
            visibility: 'PRIVATE',
          },
        });
      } catch (e: any) {
        // P2002 = unique violation. Two concurrent /me calls can both find nothing
        // and both try to insert; the loser re-reads rather than 500ing.
        if (e?.code === 'P2002') {
          passport = await prisma.trustPassport.findUnique({ where: { userId } });
        }
        if (!passport) throw e;
      }
    }

    return res.json({ success: true, data: passport });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/user/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const passport = await prisma.trustPassport.findUnique({ where: { userId: targetUserId } });
    if (!passport) return res.status(404).json({ success: false, error: 'Passport not found' });
    // 404, not 403, for a private passport: 403 confirms the passport exists.
    // `/:handle` already returns 404 via getPublic's "Passport is private" throw,
    // so this keeps the two paths from leaking existence to different degrees.
    if (passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found' });
    }
    return res.json({ success: true, data: passport });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:handle/request', async (req: Request, res: Response) => {
  try {
    const ctx = await trustPassportService.getRequestContext(req.params.handle);
    return res.json({ success: true, data: ctx });
  } catch (e: any) {
    return res.status(404).json({ success: false, error: e.message });
  }
});

router.put('/privacy', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { visibility, privacySettings } = req.body ?? {};

    // `visibility` gates whether anyone can read this passport at all, so it is
    // the one field on this route that must not be written unvalidated. It was
    // previously passed straight from the body into the update, so a PUT with
    // {"visibility":"GONE"} persisted a state the rest of the app does not
    // understand — getPublic then treats the passport as neither public nor
    // private and the row becomes unlistable and unreadable at once.
    const LEGAL = ['PUBLIC', 'PRIVATE', 'MODULE_ONLY'];
    if (visibility !== undefined && !LEGAL.includes(visibility)) {
      return res.status(400).json({
        success: false,
        error: `visibility must be one of ${LEGAL.join(', ')}`,
      });
    }
    if (privacySettings !== undefined && (typeof privacySettings !== 'object' || privacySettings === null || Array.isArray(privacySettings))) {
      return res.status(400).json({ success: false, error: 'privacySettings must be an object' });
    }

    const passport = await prisma.trustPassport.findUnique({ where: { userId } });
    if (!passport) return res.status(404).json({ success: false, error: 'Passport not found' });

    const updated = await prisma.trustPassport.update({
      where: { id: passport.id },
      data: {
        ...(visibility !== undefined ? { visibility } : {}),
        ...(privacySettings !== undefined ? { privacySettings } : {}),
      },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Catch-all MUST stay last. Anything declared below `/:handle` is unreachable
// for a single-segment GET, and unreachable without any error at build time.
router.get('/:handle', async (req: Request, res: Response) => {
  try {
    const snap = await trustPassportService.getPublic(req.params.handle);
    return res.json({ success: true, data: snap });
  } catch (e: any) {
    return res.status(404).json({ success: false, error: e.message });
  }
});

export default router;
