import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAttestationsForPassport } from '../services/onchain-attestation.service';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/trust-profile/:passportId — public, no auth
router.get('/:passportId', async (req: Request, res: Response) => {
  try {
    const { passportId } = req.params;

    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
      select: {
        id: true,
        handle: true,
        displayName: true,
        category: true,
        visibility: true,
        paymentScore: true,
        showUpScore: true,
        deliveryScore: true,
        paymentSampleSize: true,
        showUpSampleSize: true,
        deliverySampleSize: true,
        verifiedIdentity: true,
        createdAt: true,
        _count: {
          select: { invoiceTrustEvents: true },
        },
      },
    });

    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    const attestations = await getAttestationsForPassport(passportId);
    const latestExplorerUrl = attestations[0]?.explorerUrl || null;

    return res.json({
      success: true,
      data: {
        displayName: passport.displayName,
        handle: passport.handle,
        category: passport.category,
        paymentScore: passport.paymentScore ?? 500,
        showUpScore: passport.showUpScore ?? 500,
        deliveryScore: passport.deliveryScore ?? 500,
        paymentSampleSize: passport.paymentSampleSize,
        showUpSampleSize: passport.showUpSampleSize,
        deliverySampleSize: passport.deliverySampleSize,
        verifiedIdentity: passport.verifiedIdentity,
        totalEvents: passport._count.invoiceTrustEvents,
        memberSince: passport.createdAt.toISOString(),
        onchain: {
          verifiedCount: attestations.length,
          latestExplorerUrl,
          attestations: attestations.map(a => ({
            eventType: a.eventType,
            referenceId: a.referenceId,
            txSignature: a.txSignature,
            explorerUrl: a.explorerUrl,
            createdAt: a.createdAt,
          })),
        },
      },
    });
  } catch (err) {
    console.error('[TrustProfile] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/trust-profile/stats/count — public, returns total verified businesses
router.get('/stats/count', async (_req: Request, res: Response) => {
  try {
    const count = await prisma.trustPassport.count({
      where: { visibility: 'PUBLIC' },
    });

    // Get 8 sample profiles (anonymized)
    const samples = await prisma.trustPassport.findMany({
      where: { visibility: 'PUBLIC' },
      select: {
        id: true,
        displayName: true,
        category: true,
        paymentScore: true,
        showUpScore: true,
        deliveryScore: true,
      },
      orderBy: { paymentScore: 'desc' },
      take: 8,
    });

    return res.json({
      success: true,
      data: {
        totalBusinesses: count,
        samples: samples.map(s => ({
          id: s.id,
          initial: s.displayName.charAt(0).toUpperCase(),
          category: s.category,
          avgScore: Math.round(((s.paymentScore ?? 500) + (s.showUpScore ?? 500) + (s.deliveryScore ?? 500)) / 3),
        })),
      },
    });
  } catch (err) {
    console.error('[TrustProfile] Stats error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
