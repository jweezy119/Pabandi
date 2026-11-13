import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { payoutVerificationService } from '../services/payout-verification.service';

const router = Router();

// GET /api/v1/payout-verification/status — current user's payout route
router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { payoutMethod: true, payoutAccountRef: true, isPayoutVerified: true, payoutVerifiedAt: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// POST /api/v1/payout-verification — submit { payoutMethod: WALLET|BANK_ESFCA, accountRef, bankName }
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { payoutMethod, accountRef, bankName } = req.body || {};
    const method = payoutMethod === 'WALLET' ? 'WALLET' : 'BANK_ESFCA';
    const err = payoutVerificationService.validate(method, accountRef);
    if (err) return res.status(400).json({ success: false, error: err });
    const user = await payoutVerificationService.submit(req.user!.id, method, String(accountRef), bankName ? String(bankName) : undefined);
    res.json({ success: true, data: user, message: 'Payout method saved and verified for instant Raast off-ramp.' });
  } catch (e) { next(e); }
});

// GET /api/v1/payout-verification/pending — coordinator queue
router.get('/pending', authenticate, authorize('ADMIN', 'COORDINATOR'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { payoutMethod: { not: null }, isPayoutVerified: false },
      select: { id: true, firstName: true, lastName: true, phone: true, payoutMethod: true, payoutAccountRef: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

// POST /api/v1/payout-verification/:userId/approve — coordinator approves
router.post('/:userId/approve', authenticate, authorize('ADMIN', 'COORDINATOR'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await payoutVerificationService.approve(req.params.userId, req.user!.id);
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

export default router;

