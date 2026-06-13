import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { ApiKeyRequest } from '../middleware/apiKey.middleware';
import crypto from 'crypto';

// ─── Score Endpoint ────────────────────────────────────────────────────────────

export const getReliabilityScore = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      externalUserId,
      email,
      phone,
      customerHistory,
      timeFactors,
      bookingFactors,
      businessFactors,
      serviceFactors,
      eventFactors,
    } = req.body;

    if (!externalUserId) {
      return res.status(400).json({
        success: false,
        error: 'externalUserId is required',
      });
    }

    // Optionally cross-reference a Pabandi user for enriched scoring
    let pabandiReliabilityScore: number | null = null;
    if (email || phone) {
      const whereClause = email ? { email } : { phone };
      const pabandiUser = await prisma.user.findFirst({
        where: whereClause,
        select: { reliabilityScore: true },
      });
      pabandiReliabilityScore = pabandiUser?.reliabilityScore ?? null;
    }

    // Build feature set for the predictor
    const features = {
      customerHistory,
      timeFactors,
      bookingFactors,
      businessFactors,
      serviceFactors,
      eventFactors,
    };

    // Run prediction
    const prediction = await noShowPredictor.predict(features);

    // Blend Pabandi's own reliabilityScore if available (0-100 scale)
    // A higher reliabilityScore lowers the final riskScore
    let finalRiskScore = prediction.riskScore;
    if (pabandiReliabilityScore !== null) {
      // Each point of Pabandi score above 50 reduces risk by 0.3 pts
      const bonus = Math.max(0, pabandiReliabilityScore - 50) * 0.3;
      finalRiskScore = Math.max(0, Math.round(prediction.riskScore - bonus));
    }

    const requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
    const client = req.apiClient!;
    const quotaRemaining = Math.max(0, client.callsLimit - client.callsUsed - 1);

    logger.info(
      `[External API] Score for externalUserId=${externalUserId} riskScore=${finalRiskScore} client=${client.name}`
    );

    return res.status(200).json({
      success: true,
      data: {
        requestId,
        externalUserId,
        pabandiEnriched: pabandiReliabilityScore !== null,
        reliabilityScore: pabandiReliabilityScore ?? Math.round((1 - prediction.probability) * 100),
        riskScore: finalRiskScore,
        riskLevel: prediction.riskLevel,
        probability: prediction.probability,
        factors: prediction.factors,
        depositRecommendation: prediction.depositRecommendation,
        overbookingAdvice: prediction.overbookingAdvice ?? null,
        meta: {
          tier: client.tier,
          quotaUsed: client.callsUsed + 1,
          quotaLimit: client.callsLimit,
          quotaRemaining,
          scoredAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('[External API] getReliabilityScore error:', error);
    next(error);
  }
};

// ─── Public Pabandi User Profile ───────────────────────────────────────────────

export const getPabandiUserProfile = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const stats = await prisma.reservation.groupBy({
      by: ['status'],
      where: { customerId: userId },
      _count: { id: true },
    });

    const getCount = (status: string) =>
      stats.find((s) => s.status === status)?._count.id ?? 0;

    const totalCompleted = getCount('COMPLETED');
    const totalNoShows = getCount('NO_SHOW');
    const totalReservations = stats.reduce((acc, s) => acc + s._count.id, 0);

    const tier =
      user.reliabilityScore >= 80
        ? 'EXCELLENT'
        : user.reliabilityScore >= 50
        ? 'AVERAGE'
        : 'RISKY';

    return res.status(200).json({
      success: true,
      data: {
        userId,
        reliabilityScore: user.reliabilityScore,
        tier,
        totalReservations,
        totalCompleted,
        totalNoShows,
        memberSince: user.createdAt,
        meta: {
          tier: req.apiClient!.tier,
          scoredAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('[External API] getPabandiUserProfile error:', error);
    next(error);
  }
};

// ─── Quota Usage ───────────────────────────────────────────────────────────────

export const getUsage = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const client = req.apiClient!;

    // Fetch last 30 days of usage stats
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const dailyUsage = await prisma.apiUsageLog.groupBy({
      by: ['createdAt'],
      where: {
        clientId: client.id,
        createdAt: { gte: since },
      },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: {
        client: {
          name: client.name,
          tier: client.tier,
        },
        quota: {
          used: client.callsUsed,
          limit: client.callsLimit,
          remaining: Math.max(0, client.callsLimit - client.callsUsed),
          percentUsed: Math.round((client.callsUsed / client.callsLimit) * 100),
        },
        recentActivity: dailyUsage.map((d) => ({
          date: d.createdAt,
          calls: d._count.id,
        })),
      },
    });
  } catch (error) {
    logger.error('[External API] getUsage error:', error);
    next(error);
  }
};
