import { Router } from 'express';
import {
  createBusiness,
  getBusiness,
  updateBusiness,
  getBusinessReservations,
  getBusinessAnalytics,
} from '../controllers/business.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All business routes require authentication
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const { googlePlaceId } = req.query;
    
    const where: any = { isActive: true };
    if (googlePlaceId) {
      where.googlePlaceId = String(googlePlaceId);
    }
    
    const businesses = await prisma.business.findMany({ where });
    res.json({ success: true, data: { businesses } });
  } catch (error) {
    next(error);
  }
});

// GET /businesses/me — fetch the logged-in owner's business
router.get('/me', async (req: any, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user.id },
      include: { settings: true, businessHours: true },
    });
    if (!business) {
      return res.json({ success: true, data: { business: null } });
    }
    res.json({ success: true, data: { business } });
  } catch (error) {
    next(error);
  }
});

router.post('/', createBusiness);
router.get('/:id', getBusiness);
router.put('/:id', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusiness);
router.get('/:id/reservations', getBusinessReservations);
router.get('/:id/analytics', getBusinessAnalytics);

export default router;
