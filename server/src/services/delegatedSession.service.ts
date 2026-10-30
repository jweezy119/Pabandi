import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Delegated sessions — an external AI agent opens an escrow tab for a human
 * who has not yet signed in, and hands that human a link to fund it.
 *
 * This is the bridge between consumer AI assistants (which can negotiate and
 * book a service on a user's behalf) and Pabandi's escrow, which requires a
 * human to actually lock the funds. The agent creates the *promise*; the human
 * funds it at the handoff link, which flips the session from `pending` to
 * `active`. Until then the row is inert: executeTransaction() only ever touches
 * `active` sessions, so an unfunded delegated session cannot be spent against.
 *
 * ─── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * Nothing here touches Solana. A delegated session is a database row, and
 * `status: 'active'` after funding still means "the human promised these
 * funds", not "the funds have settled on-chain". Settlement is the existing
 * deferred path (closeSession), unchanged by this module.
 */

/** An abandoned handoff expires after this. Matches the "expires in 2 hours"
 *  requirement: long enough to fund, short enough that a stale spend capability
 *  does not linger. */
export const HANDOFF_TTL_HOURS = 2;

export interface CreateDelegatedSessionInput {
  userEmail: string;
  amount: number;
  serviceId: string;
  /** Resolved agent id (req.apiClient.id), recorded on the session. */
  agentId: string;
  serviceLabel?: string;
  webhookUrl?: string;
  /** Base origin for the handoff link; defaults to the SPA, overridable via env. */
  frontendUrl: string;
}

export interface CreateDelegatedSessionResult {
  sessionId: string;
  handoffUrl: string;
  expiresAt: string;
}

/**
 * Open a `pending` session for the human and return the link to hand them.
 *
 * The id is Prisma's cuid (the row id, and therefore the capability the URL
 * carries), so the session is created first and the `handoffUrl` — which
 * embeds that id — is written back. Two writes rather than minting an id
 * ourselves: the URL must point at the real row id, and cuid generation lives
 * with Prisma. The window between the two writes is inert (nothing reads the
 * row until we return), so it is safe.
 */
export async function createDelegatedSession(
  input: CreateDelegatedSessionInput
): Promise<CreateDelegatedSessionResult> {
  const ownerId = input.userEmail.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_HOURS * 60 * 60 * 1000);
  const frontendUrl = input.frontendUrl.replace(/\/+$/, '');

  const created = await prisma.pabandiSession.create({
    data: {
      ownerType: 'user',
      ownerId,
      ephemeralKey: crypto.randomBytes(32).toString('base64url'),
      totalLimit: input.amount,
      spent: 0,
      status: 'pending',
      currency: 'USDC',
      expiresAt,
      delegatedByAgentId: input.agentId,
      serviceId: input.serviceId,
      serviceLabel: input.serviceLabel ?? null,
      webhookUrl: input.webhookUrl ?? null,
    },
    select: { id: true },
  });

  const handoffUrl = `${frontendUrl}/handoff/${created.id}`;
  await prisma.pabandiSession.update({
    where: { id: created.id },
    data: { handoffUrl },
  });

  logger.info(
    `[DelegatedSession] created ${created.id} agent=${input.agentId} amount=${input.amount} for ${ownerId}`
  );

  return { sessionId: created.id, handoffUrl, expiresAt: expiresAt.toISOString() };
}
