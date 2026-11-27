import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export interface AgentActionAuditInput {
  agentKeyId: string;
  agentId?: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  amountUsd?: number | null;
  currency?: string;
  status: 'success' | 'failed' | 'pending';
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, any> | null;
}

export async function logAgentAction(input: AgentActionAuditInput): Promise<void> {
  try {
    await prisma.agentActionAudit.create({
      data: {
        agentKeyId: input.agentKeyId,
        agentId: input.agentId ?? null,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        amountUsd: input.amountUsd ?? null,
        currency: input.currency ?? 'USD',
        status: input.status,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (error: any) {
    logger.error('[AgentAudit] Failed to log action:', error?.message || error);
  }
}

export async function getAgentActionAudit(agentKeyId: string, options?: {
  limit?: number;
  cursor?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { limit = 100, cursor, action, startDate, endDate } = options ?? {};
  
  const where: any = { agentKeyId };
  
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  return prisma.agentActionAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getUserAgentActionAudit(userId: string, options?: {
  limit?: number;
  cursor?: string;
}) {
  const { limit = 100, cursor } = options ?? {};
  
  return prisma.agentActionAudit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}