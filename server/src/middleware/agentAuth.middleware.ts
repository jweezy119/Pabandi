import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { findAgentKeyByRaw, touchAgentKey } from '../services/agentKeys.service';
import { authenticate, optionalAuthenticate, AuthRequest } from './auth.middleware';
import { CustomError } from './errorHandler';

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
