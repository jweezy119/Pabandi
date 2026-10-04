import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { paymentRails } from '../payments/rails';

const router = Router();
router.use(authenticate);
// AUTHENTICATED.
//
// This router had NO authentication at all — every route below was reachable by anyone
// who could reach the API, and each one takes a tenant from the query string or body.
// That is 4 routes of business financials and writes (rent generation, late fees,
// lease renewal, inspections, maintenance vendors, cashflow) with no caller identity.
//
// `router.use` rather than per-route so a route added later is covered by default. Adding
// auth per handler is how the next one ends up unprotected.



router.get('/', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const methods = await prisma.businessPaymentMethod.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: methods });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { businessId, railId, target } = req.body;
    
    const rail = paymentRails[railId];
    if (!rail) {
      return res.status(400).json({ success: false, error: 'Invalid rail ID' });
    }
    
    if (!rail.validateTarget(target)) {
      return res.status(400).json({ success: false, error: 'Invalid target format for this rail' });
    }

    const existingCount = await prisma.businessPaymentMethod.count({ where: { businessId } });
    const isDefault = existingCount === 0;

    const method = await prisma.businessPaymentMethod.create({
      data: {
        businessId,
        railId,
        displayName: rail.name,
        target,
        isDefault,
      },
    });
    res.json({ success: true, data: method });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.body;
    
    // Unset current default
    await prisma.businessPaymentMethod.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const method = await prisma.businessPaymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });
    res.json({ success: true, data: method });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.businessPaymentMethod.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
