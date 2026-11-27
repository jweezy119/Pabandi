import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { CustomError } from './errorHandler';
import { logger } from '../utils/logger';

export interface ApiKeyRequest extends Request {
  apiClient?: {
    id: string;
    name: string;
    email: string;
    tier: string;
    callsUsed: number;
    callsLimit: number;
    businessId: string | null;
    agentKeyId: string | null;
    agentId: string | null;
    scopes: string[];
    spendLimitUsd: number | null;
    spendUsedUsd: number;
  };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export const apiKeyAuth = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  let apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim();
    }
  }

  if (!apiKey) {
    return next(new CustomError('Missing API key. Provide via x-api-key header or Authorization: Bearer <key>', 401));
  }

  const keyHash = hashApiKey(apiKey);

  const key = await prisma.agentApiKey.findUnique({
    where: { keyHash },
  });

  if (!key || key.revokedAt) {
    logger.warn(`[ApiKeyAuth] rejected invalid or revoked API key from ${req.ip}`);
    return next(new CustomError('Invalid or revoked API key', 401));
  }

  const owner = await prisma.user.findUnique({
    where: { id: key.ownerUserId },
    select: { id: true, email: true, role: true, business: { select: { id: true } } },
  });

  if (!owner) {
    return next(new CustomError('API key owner not found', 401));
  }

  req.apiClient = {
    id: key.id,
    name: key.name,
    email: owner.email,
    tier: key.scopes.includes('*') ? 'ENTERPRISE' : 'PRO',
    callsUsed: Math.round(key.spendUsedUsd * 100),
    callsLimit: key.spendLimitUsd != null ? Math.round(key.spendLimitUsd * 100) : 0,
    businessId: owner.business?.id ?? null,
    agentKeyId: key.id,
    agentId: key.agentId ?? null,
    scopes: key.scopes,
    spendLimitUsd: key.spendLimitUsd,
    spendUsedUsd: key.spendUsedUsd,
  };

  next();
};

export const logApiUsage = (
  req: ApiKeyRequest,
  res: Response,
  endpoint: string
) => {
  // Operational no-op
};
