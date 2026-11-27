import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/database';
import { findAgentKeyByRaw, touchAgentKey } from '../services/agentKeys.service';
import { authenticate, optionalAuthenticate, AuthRequest } from './auth.middleware';
import { CustomError } from './errorHandler';

const AGENT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const AGENT_RATE_LIMIT_MAX = 60; // 60 requests per minute per agent key
const AGENT_MONEY_RATE_LIMIT_MAX = 10; // 10 money-moving requests per minute per agent key

export const agentRateLimiter = rateLimit({
  windowMs: AGENT_RATE_LIMIT_WINDOW_MS,
  max: AGENT_RATE_LIMIT_MAX,
  message: { success: false, error: 'Agent rate limit exceeded (60 req/min)' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `agent-${req.user?.agentKeyId || req.ip}`,
  skip: (req: any) => !req.user?.agentKeyId, // Only apply to authenticated agent requests
});

export const agentMoneyRateLimiter = rateLimit({
  windowMs: AGENT_RATE_LIMIT_WINDOW_MS,
  max: AGENT_MONEY_RATE_LIMIT_MAX,
  message: { success: false, error: 'Agent money-operation rate limit exceeded (10 req/min)' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `agent-money-${req.user?.agentKeyId || req.ip}`,
  skip: (req: any) => !req.user?.agentKeyId,
});

async function resolveAgentKey(req: Request) {
  const rawKey = req.header('x-api-key');
  if (!rawKey) return null;

  const key = await findAgentKeyByRaw(rawKey);
  if (!key) throw new CustomError('Invalid agent API key', 401);

  await touchAgentKey(key.id);
  const owner = await prisma.user.findUnique({
    where: { id: key.ownerUserId },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true },
  });

  if (!owner) throw new CustomError('Agent key owner not found', 401);

  (req as AuthRequest).user = {
    id: owner.id,
    email: owner.email,
    role: owner.role,
    firstName: owner.firstName,
    lastName: owner.lastName,
    phone: owner.phone ?? undefined,
    agentKeyId: key.id,
    agentId: key.agentId ?? undefined,
    scopes: key.scopes,
    spendLimitUsd: key.spendLimitUsd,
    spendUsedUsd: key.spendUsedUsd,
  } as any;
}

export const authenticateAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.header('x-api-key')) {
      await resolveAgentKey(req);
      return next();
    }
    return authenticate(req as AuthRequest, res, next);
  } catch (error) {
    return next(error);
  }
};

/**
 * Gates money-moving agent routes. `authenticateAgent` falls back to a normal
 * user JWT when no x-api-key is present; without this guard that JWT could call
 * payout/escrow tools with no key, no scopes, no spend cap and no rate limit.
 */
export const requireAgentKey = (req: Request, _res: Response, next: NextFunction) => {
  if (!(req as any).user?.agentKeyId) {
    return next(new CustomError('An agent API key is required for this operation', 403));
  }
  return next();
};

export const optionalAgentAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.header('x-api-key')) {
      await resolveAgentKey(req);
      return next();
    }
    return optionalAuthenticate(req as AuthRequest, res, next);
  } catch (error) {
    return next(error);
  }
};
