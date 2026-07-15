import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/passport/public/:sellerId
 * Public trust summary for a seller/business.
 * Does NOT require API key auth.
 */
router.get('/public/:sellerId', async (req: any, res: Response): Promise<any> => {
  try {
    const sellerId = req.params.sellerId;
    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'sellerId is required.' });
    }

    const business = await prisma.business.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        description: true,
        coverImageUrl: true,
        rating: true,
        reviewCount: true,
        trustScore: true,
        reliabilityScore: true,
        isVerified: true,
      },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Seller not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        business,
        passportUrl: `${req.protocol}://${req.get('host')}/passport/${business.id}`,
        tapUrl: `${req.protocol}://${req.get('host')}/t/pay/${business.id}`,
      },
    });
  } catch (error) {
    console.error('[PublicPassport] error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
