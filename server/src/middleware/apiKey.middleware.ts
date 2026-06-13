import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from './errorHandler';

export interface ApiKeyRequest extends Request {
  apiClient?: {
    id: string;
    name: string;
    email: string;
    tier: string;
    callsUsed: number;
    callsLimit: number;
  };
  requestStartTime?: number;
}

const TIER_LIMITS: Record<string, number> = {
  STARTER: 500,
  GROWTH: 10_000,
  ENTERPRISE: 100_000,
};

/**
 * Validates the x-api-key header, enforces quota, and attaches
 * the resolved ApiClient to req.apiClient.
 */
export const apiKeyAuth = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  req.requestStartTime = Date.now();
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    return next(new CustomError('Missing x-api-key header', 401));
  }

  try {
    const client = await prisma.apiClient.findUnique({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        callsUsed: true,
        callsLimit: true,
        isActive: true,
      },
    });

    if (!client) {
      return next(new CustomError('Invalid API key', 401));
    }

    if (!client.isActive) {
      return next(new CustomError('API key has been revoked', 403));
    }

    // Enforce hard quota cap (Starter tier) or soft cap with overage for paid tiers
    const hardCapTiers = ['STARTER'];
    if (hardCapTiers.includes(client.tier) && client.callsUsed >= client.callsLimit) {
      return next(
        new CustomError(
          `Monthly quota exhausted (${client.callsLimit} calls). Upgrade your plan at pabandi.com/developer`,
          429
        )
      );
    }

    req.apiClient = {
      id: client.id,
      name: client.name,
      email: client.email,
      tier: client.tier,
      callsUsed: client.callsUsed,
      callsLimit: client.callsLimit,
    };

    next();
  } catch (error) {
    logger.error('API key validation error:', error);
    next(error);
  }
};

/**
 * Records the API call in ApiUsageLog and increments callsUsed.
 * Must be used AFTER the response is sent (via res.on('finish')).
 */
export const logApiUsage = (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  res.on('finish', () => {
    if (!req.apiClient) return;

    const latencyMs = Date.now() - (req.requestStartTime ?? Date.now());
    const clientId = req.apiClient.id;
    const endpoint = req.path;
    const statusCode = res.statusCode;

    // Fire-and-forget — do not block the response
    Promise.all([
      prisma.apiUsageLog.create({
        data: { clientId, endpoint, statusCode, latencyMs },
      }),
      prisma.apiClient.update({
        where: { id: clientId },
        data: { callsUsed: { increment: 1 } },
      }),
    ]).catch((err) => logger.error('Failed to log API usage:', err));
  });

  next();
};
