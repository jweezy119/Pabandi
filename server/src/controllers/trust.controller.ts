import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { trustAttestationService } from '../services/trustAttestation.service';
import { trustScoreService } from '../services/trustScore.service';

/**
 * GET /api/trust/public/:userId
 * Public endpoint to fetch a user's trust profile and cryptographic attestation.
 */
export const getPublicTrustProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        trustScore: true,
        verificationTier: true,
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const attestation = await trustAttestationService.issue(userId);
    const velocity = await trustScoreService.computeVelocity(userId);

    // Mocking rank and percentile for the demo
    const rank = Math.floor(Math.random() * 5000) + 1;
    const percentile = Math.floor(Math.random() * 20) + 80; // 80-99

    res.json({
      success: true,
      data: {
        score: user.trustScore,
        tier: user.verificationTier,
        rank,
        percentile,
        methodology: "1.0.0",
        attestation,
        trustVelocity: velocity
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/trust/audit/:userId
 * Fetch the gamified Trust Timeline (audit trail) for a user.
 */
export const getTrustAuditTimeline = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const audits = await prisma.trustAuditTrail.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        changeReason: true,
        previousScore: true,
        newScore: true,
        severity: true,
        component: true
      }
    });

    const timeline = audits.map(a => ({
      date: a.createdAt,
      pointsDelta: Math.round((a.newScore - a.previousScore) * 10) / 10,
      reason: a.changeReason,
      severity: a.severity,
      component: a.component
    }));

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
};
