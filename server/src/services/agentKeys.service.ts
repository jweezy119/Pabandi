import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { AgentToolUser } from './agentTools.service';

const KEY_PREFIX = 'pab_live_';
const ALLOWED_SCOPES = ['directory', 'booking', 'trust', 'payout', 'proof', 'identity', '*'];

// Default spend limit for new agent keys (USD) - conservative for security
const DEFAULT_SPEND_LIMIT_USD = 1000;
const MONEY_SCOPES = ['booking', 'payout'];

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

  // `*` implies every money scope. Previously it bypassed the spend-limit check
  // entirely, so any user could mint an unlimited key and drive payout tools.
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { role: true },
  });
  if (!owner) throw new Error('Agent key owner not found');
  if (scopes.includes('*') && owner.role !== 'ADMIN') {
    throw new Error('The * scope is restricted to ADMIN accounts');
  }

  const hasMoneyScope = scopes.some((s) => MONEY_SCOPES.includes(s) || s === '*');
  const spendLimitUsd = input.spendLimitUsd ?? (hasMoneyScope ? DEFAULT_SPEND_LIMIT_USD : null);

  if (spendLimitUsd != null && (!Number.isFinite(Number(spendLimitUsd)) || Number(spendLimitUsd) < 0)) {
    throw new Error('spendLimitUsd must be a finite number, zero or greater');
  }

  // Money-moving keys must carry a bounded cap — no unlimited payout keys.
  if (hasMoneyScope && (spendLimitUsd === null || !Number.isFinite(Number(spendLimitUsd)))) {
    throw new Error('A finite spendLimitUsd is required for keys with booking, payout or * scopes');
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
      spendLimitUsd: spendLimitUsd,
    },
  });

  logger.info(`[AgentKeys] Created key ${row.id} for owner ${ownerUserId} with spend limit ${spendLimitUsd ?? 'unlimited'}`);
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
