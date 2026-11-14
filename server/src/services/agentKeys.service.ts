import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'pab_live_';

export function hashAgentKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function generateAgentKey(): string {
  return `${KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

export async function createAgentKey(
  ownerUserId: string,
  input: { name: string; agentId?: string; scopes?: string[]; spendLimitUsd?: number }
) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Key name is required');

  const rawKey = generateAgentKey();
  const keyHash = hashAgentKey(rawKey);

  const row = await prisma.agentApiKey.create({
    data: {
      keyHash,
      name,
      ownerUserId,
      agentId: input.agentId || null,
      scopes: input.scopes ?? [],
      spendLimitUsd: input.spendLimitUsd ?? null,
    },
  });

  logger.info(`[AgentKeys] Created key ${row.id} for owner ${ownerUserId}`);
  return {
    id: row.id,
    name: row.name,
    key: rawKey,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    scopes: row.scopes,
    spendLimitUsd: row.spendLimitUsd,
    createdAt: row.createdAt,
  };
}

export async function listAgentKeys(ownerUserId: string) {
  return prisma.agentApiKey.findMany({
    where: { ownerUserId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      agentId: true,
      scopes: true,
      spendLimitUsd: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
}

export async function revokeAgentKey(ownerUserId: string, keyId: string) {
  const row = await prisma.agentApiKey.findFirst({ where: { id: keyId, ownerUserId } });
  if (!row) throw new Error('Agent API key not found');
  if (row.revokedAt) return row;

  return prisma.agentApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
}

export async function findAgentKeyByRaw(rawKey: string) {
  const keyHash = hashAgentKey(rawKey);
  const row = await prisma.agentApiKey.findUnique({ where: { keyHash } });
  if (!row || row.revokedAt) return null;
  return row;
}

export async function touchAgentKey(id: string) {
  await prisma.agentApiKey
    .update({ where: { id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
}
