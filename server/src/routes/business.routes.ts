import { Router } from 'express';
import {
  createBusiness,
  getBusiness,
  updateBusiness,
  getBusinessReservations,
  getBusinessAnalytics,
  getBusinessReviews,
  claimBusiness,
} from '../controllers/business.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public route to get businesses for the homepage/search
router.get('/', async (req, res, next) => {
  try {
    const { prisma } = await import('../utils/database');
    const { googlePlaceId, category, search } = req.query;
    
    const where: any = { isActive: true };
    if (googlePlaceId) {
      where.googlePlaceId = String(googlePlaceId);
    }
    if (category && category !== 'ALL') {
      where.category = String(category);
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    
    const businesses = await prisma.business.findMany({ 
      where,
      include: {
        googleReviews: true
      }
    });
    res.json({ success: true, data: { businesses } });
  } catch (error) {
    next(error);
  }
});

// All subsequent business routes require authentication
router.use(authenticate);

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
router.post('/:id/claim', claimBusiness);
router.get('/:id', getBusiness);
router.put('/:id', authorize('BUSINESS_OWNER', 'ADMIN'), updateBusiness);
router.get('/:id/reservations', getBusinessReservations);
router.get('/:id/analytics', getBusinessAnalytics);
router.get('/:id/reviews', getBusinessReviews);

export default router;
