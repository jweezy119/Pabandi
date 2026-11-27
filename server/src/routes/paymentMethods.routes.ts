import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { paymentRails } from '../payments/rails';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

async function resolveOwnedBusinessId(
  userId: string,
  requestedBusinessId?: unknown,
): Promise<string | null> {
  const requested =
    typeof requestedBusinessId === 'string' && requestedBusinessId.trim().length > 0
      ? requestedBusinessId.trim()
      : undefined;

  const business = requested
    ? await prisma.business.findFirst({
        where: { id: requested, ownerId: userId },
        select: { id: true },
      })
    : await prisma.business.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

  return business?.id ?? null;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const businessId = await resolveOwnedBusinessId(userId, req.query.businessId);
    if (!businessId) {
      return res.status(403).json({
        success: false,
        error: 'Business not found or not owned by this account',
      });
    }

    const methods = await prisma.businessPaymentMethod.findMany({
      where: { businessId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json({ success: true, data: methods });
  } catch (err: any) {
    logger.error('[PaymentMethods] GET / failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Could not load payment methods' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { businessId: requestedBusinessId, railId, target } = req.body ?? {};
    const businessId = await resolveOwnedBusinessId(userId, requestedBusinessId);
    if (!businessId) {
      return res.status(403).json({
        success: false,
        error: 'Business not found or not owned by this account',
      });
    }

    if (typeof railId !== 'string' || !paymentRails[railId]) {
      return res.status(400).json({ success: false, error: 'Invalid payment rail ID' });
    }

    const rail = paymentRails[railId];
    const cleanedTarget = typeof target === 'string' ? target.trim() : '';
    if (!cleanedTarget || !rail.validateTarget(cleanedTarget)) {
      return res.status(400).json({
        success: false,
        error: `Invalid payout target format for ${rail.name}`,
      });
    }

    // For Solana self-custody/embedded payout addresses, update in place if one
    // already exists for this business so reconnecting does not duplicate rows.
    if (railId === 'solana') {
      const existingSolana = await prisma.businessPaymentMethod.findFirst({
        where: { businessId, railId: 'solana' },
        orderBy: { createdAt: 'desc' },
      });
      if (existingSolana) {
        const updated = await prisma.businessPaymentMethod.update({
          where: { id: existingSolana.id },
          data: { target: cleanedTarget, displayName: rail.name },
        });
        return res.json({ success: true, data: updated });
      }
    }

    const existingCount = await prisma.businessPaymentMethod.count({ where: { businessId } });
    const isDefault = existingCount === 0;

    const method = await prisma.businessPaymentMethod.create({
      data: {
        businessId,
        railId,
        displayName: rail.name,
        target: cleanedTarget,
        isDefault,
      },
    });
    return res.status(201).json({ success: true, data: method });
  } catch (err: any) {
    logger.error('[PaymentMethods] POST / failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Could not save payment method' });
  }
});

router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    const businessId = await resolveOwnedBusinessId(userId, req.body?.businessId);
    if (!businessId) {
      return res.status(403).json({
        success: false,
        error: 'Business not found or not owned by this account',
      });
    }

    const existing = await prisma.businessPaymentMethod.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Payment method not found' });
    }

    const [, method] = await prisma.$transaction([
      prisma.businessPaymentMethod.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.businessPaymentMethod.update({
        where: { id: existing.id },
        data: { isDefault: true },
      }),
    ]);

    return res.json({ success: true, data: method });
  } catch (err: any) {
    logger.error('[PaymentMethods] PUT /:id/default failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Could not update default payment method' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    const existing = await prisma.businessPaymentMethod.findFirst({
      where: { id, business: { ownerId: userId } },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Payment method not found' });
    }

    await prisma.businessPaymentMethod.delete({ where: { id: existing.id } });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[PaymentMethods] DELETE /:id failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Could not remove payment method' });
  }
});

export default router;
