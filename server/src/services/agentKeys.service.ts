import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { AgentToolUser } from './agentTools.service';

const KEY_PREFIX = 'pab_live_';
const ALLOWED_SCOPES = ['directory', 'booking', 'trust', 'payout', 'proof', 'identity', '*'];

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

  const scopes = input.scopes ?? [];
  const invalidScope = scopes.find((scope) => !ALLOWED_SCOPES.includes(scope));
  if (invalidScope) {
    throw new Error(`Invalid scope: ${invalidScope}. Allowed: ${ALLOWED_SCOPES.join(', ')}`);
  }

  const spendLimitUsd = input.spendLimitUsd ?? null;
  if (spendLimitUsd != null && Number(spendLimitUsd) < 0) {
    throw new Error('spendLimitUsd must be zero or greater');
  }

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
      spendUsedUsd: true,
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

export async function assertAgentSpendAllowed(user: AgentToolUser, amount: number) {
  if (!user.agentKeyId) return;
  const key = await prisma.agentApiKey.findUnique({ where: { id: user.agentKeyId } });
  if (!key) throw new Error('Agent API key not found');
  if (key.revokedAt) throw new Error('Agent API key is revoked');
  if (key.spendLimitUsd != null && key.spendUsedUsd + amount > key.spendLimitUsd) {
    throw new Error(
      `Agent key spend limit exceeded (limit ${key.spendLimitUsd}, used ${key.spendUsedUsd}, requested ${amount})`
    );
  }
}

export async function recordAgentSpend(user: AgentToolUser, amount: number) {
  if (!user.agentKeyId) return;
  await prisma.agentApiKey
    .update({
      where: { id: user.agentKeyId },
      data: { spendUsedUsd: { increment: amount } },
    })
    .catch((error) => {
      logger.error('[AgentKeys] Failed to record spend:', error?.message || error);
    });
}
