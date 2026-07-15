import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/passport/public/:sellerId
 * Public trust summary for a seller/business.
 */
router.get('/:sellerId', async (req: any, res: Response): Promise<any> => {
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

    const trust = Number(business.trustScore ?? 0);
    const reliability = Number(business.reliabilityScore ?? 0);

    const endorsements = [
      trust >= 80 ? { title: 'Top Trust', detail: `${trust}% trust score` } : null,
      reliability >= 80 ? { title: 'High Reliability', detail: `${reliability} reliability` } : null,
      (business.reviewCount ?? 0) >= 20 ? { title: 'Proven', detail: `${business.reviewCount} reviews` } : null,
    ].filter(Boolean) as { title: string; detail: string }[];

    return res.status(200).json({
      success: true,
      data: {
        business,
        endorsements,
        passportUrl: `${req.protocol}://${req.get('host')}/passport/${business.id}`,
        tapUrl: `${req.protocol}://${req.get('host')}/t/pay/${business.id}`,
      },
    });
  } catch (error) {
    console.error('[PublicPassport] error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/v1/passport/public/:sellerId/reviews
 * Public reviews summary for a seller/business.
 * Does NOT require auth.
 */
router.get('/:sellerId/reviews', async (req: any, res: Response): Promise<any> => {
  try {
    const sellerId = req.params.sellerId;
    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'sellerId is required.' });
    }

    const business = await prisma.business.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Seller not found.' });
    }

    const [googleReviews, pabandiReviews] = await Promise.all([
      prisma.googleReview.findMany({
        where: { businessId: sellerId },
        orderBy: { time: 'desc' },
        take: 20,
        select: {
          authorName: true,
          rating: true,
          text: true,
          time: true,
        },
      }),
      prisma.pabandiReview.findMany({
        where: { businessId: sellerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          rating: true,
          text: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const reviews = [
      ...googleReviews.map((review) => ({
        source: 'google',
        authorName: review.authorName,
        rating: review.rating,
        text: review.text,
        time: review.time,
      })),
      ...pabandiReviews.map((review) => ({
        source: 'pabandi',
        authorName: [review.customer?.firstName, review.customer?.lastName].filter(Boolean).join(' ') || 'Customer',
        rating: review.rating,
        text: review.text,
        time: review.createdAt,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return res.status(200).json({ success: true, data: { reviews } });
  } catch (error) {
    console.error('[PublicPassportReviews] error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
