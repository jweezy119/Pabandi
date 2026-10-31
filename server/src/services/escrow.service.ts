import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';
import { prisma } from '../utils/database';

export type EscrowCheckoutEnvironment = 'sandbox' | 'production';

export const ESCROW_API_BASE = process.env.ESCROW_API_BASE || 'https://api.escrow.com';
export const ESCROW_ENV: EscrowCheckoutEnvironment = process.env.NODE_ENV === 'production'
  ? 'production'
  : 'sandbox';

const ESCROW_API_EMAIL = process.env.ESCROW_API_EMAIL || '';
const ESCROW_API_KEY = process.env.ESCROW_API_KEY || '';

export type EscrowCreateTransactionResponse = {
  id?: number | string;
  url?: string;
  status?: string;
};

export const escrowService = {
  async createTransaction({
    amount,
    currency,
    buyerEmail,
    sellerEmail,
    description,
    itemTitle,
    reference,
  }: {
    amount: number;
    currency: string;
    buyerEmail: string;
    sellerEmail: string;
    description: string;
    itemTitle: string;
    reference: string;
  }): Promise<EscrowCreateTransactionResponse> {
    if (!ESCROW_API_EMAIL || !ESCROW_API_KEY) {
      return { status: 'disabled' };
    }

    try {
      const baseUrl = `${ESCROW_API_BASE}/2017-09-01/transaction${ESCROW_ENV === 'sandbox' ? '-sandbox' : ''}`;
      const payload: any = {
        parties: [
          { role: 'buyer', customer: buyerEmail },
          { role: 'seller', customer: sellerEmail },
        ],
        currency,
        description,
        items: [
          {
            title: itemTitle,
            description,
            type: 'general_merchandise',
            quantity: 1,
            schedule: [
              {
                amount,
                payer_customer: buyerEmail,
                beneficiary_customer: sellerEmail,
              },
            ],
          },
        ],
        metadata: {
          pabandiReference: reference,
        },
      };

      logger.info('[Escrow] Creating transaction reference=%s amount=%s', reference, amount);

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;
      const id = Number(data?.id) || data?.id;
      const url = data?.url || `${ESCROW_API_BASE}/transaction/${id}`;

      return {
        id,
        url,
        status: response.ok ? 'awaiting_payment' : 'error',
      };
    } catch (error: any) {
      logger.error('[Escrow] createTransaction failed: %s', error?.message || error);
      return { status: 'error' };
    }
  },

  async fundEscrow(passportId: string, amount: number, escrowId: string, invoiceId?: string) {
    await trustCore.emit('escrow.funded', { passportId, amount, escrowId, invoiceId });
  },

  async releaseEscrow(passportId: string, amount: number, escrowId: string) {
    await trustCore.emit('escrow.released', { passportId, amount, escrowId });
  },

  async disputeEscrow(passportId: string, reason: string, escrowId: string) {
    await trustCore.emit('escrow.disputed', { passportId, reason, escrowId });
  },

  // ── VCAP M2M Handshake ──────────────────────────────────────────────────────
  //
  // The machine-to-machine escrow release. No human approval: the SHA-256 math
  // IS the trust. The poster pinned a deliverableHash at post time; the provider
  // submits the real hash at delivery; the two are compared and the outcome is
  // deterministic.
  //
  //   hash matches  → funds release to the provider, both agents get
  //                   m2m.task_completed trust events.
  //   hash mismatch → no release. Escrow flips to DISPUTED and the Sulha
  //                   (dispute) layer is triggered via m2m.provenance_failed.
  async verifyAndReleaseM2M(escrowId: string, deliveredDataHash: string) {
    if (!escrowId || typeof escrowId !== 'string') {
      throw new Error('escrowId is required');
    }
    if (!deliveredDataHash || typeof deliveredDataHash !== 'string') {
      throw new Error('deliveredDataHash is required');
    }
    const submitted = deliveredDataHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(submitted)) {
      throw new Error('deliveredDataHash must be a 64-character hex SHA-256 digest');
    }

    const escrow = await prisma.agentEscrow.findUnique({
      where: { id: escrowId },
      include: { project: true },
    });
    if (!escrow) {
      throw new Error(`Escrow ${escrowId} not found`);
    }
    if (!escrow.project) {
      throw new Error(`Escrow ${escrowId} has no associated project`);
    }

    const expected = (escrow.project.deliverableHash ?? '').trim().toLowerCase();
    if (!expected) {
      // No hash pinned at post time → the handshake has no anchor. Refuse
      // rather than default to release: an unbounded release is a hole.
      throw new Error(
        `Project ${escrow.project.id} has no deliverableHash pinned. M2M release requires a hash.`
      );
    }

    const winningBid = await prisma.agentProjectBid.findFirst({
      where: { projectId: escrow.project.id, isWinning: true },
      select: { bidderId: true },
    });
    const providerId = winningBid?.bidderId ?? null;

    if (expected !== submitted) {
      // Provenance failure. Lock the escrow and fire the Sulha trigger. The
      // dispute layer resolves who is right; this is the event that starts it.
      await prisma.agentEscrow.update({
        where: { id: escrowId },
        data: { status: 'DISPUTED' },
      });
      await prisma.agentProject.update({
        where: { id: escrow.project.id },
        data: { status: 'DISPUTED' },
      });

      await trustCore.emit('m2m.provenance_failed', {
        passportId: null,
        metadata: {
          projectId: escrow.project.id,
          escrowId,
          expectedHash: expected,
          submittedHash: submitted,
          providerId,
          posterId: escrow.project.posterId,
          amount: escrow.releaseAmount,
          source: 'vcap-m2m-handshake',
        },
      });

      logger.warn('[M2M] provenance failed for escrow %s (project %s)', escrowId, escrow.project.id);

      return {
        ok: false,
        released: false,
        status: 'DISPUTED',
        reason: 'deliverableHash mismatch — escrow disputed, Sulha layer triggered',
        projectId: escrow.project.id,
        escrowId,
      };
    }

    // Hashes match. Release funds to the provider.
    await prisma.agentEscrow.update({
      where: { id: escrowId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    await prisma.agentProject.update({
      where: { id: escrow.project.id },
      data: { status: 'COMPLETED' },
    });

    if (providerId) {
      await prisma.agentProfile.update({
        where: { id: providerId },
        data: {
          totalEarned: { increment: escrow.releaseAmount },
          projectsCompleted: { increment: 1 },
          reputation: { increment: 5 },
        },
      });
      await prisma.agentProfile.update({
        where: { id: escrow.project.posterId },
        data: { totalSpent: { increment: escrow.project.budgetUsd } },
      });
      await prisma.agentMarketTransaction.create({
        data: {
          projectId: escrow.project.id,
          fromAgentId: escrow.project.posterId,
          toAgentId: providerId,
          amount: escrow.releaseAmount,
          pabReward: 0,
          platformFeeUsd: escrow.platformFee,
          platformFeeSol: 0,
          type: 'PROJECT_PAYMENT',
          status: 'COMPLETED',
        },
      });
    }

    // Trust events for both agents. `m2m.task_completed` is the score-bearing
    // event for the provider; the poster gets the same event so their
    // reliability as a client also moves.
    const emitTargets: Array<{ id: string | null; label: string }> = [
      { id: providerId, label: 'provider' },
      { id: escrow.project.posterId, label: 'poster' },
    ];
    for (const target of emitTargets) {
      if (!target.id) continue;
      try {
        await trustCore.emit('m2m.task_completed', {
          passportId: null,
          metadata: {
            projectId: escrow.project.id,
            escrowId,
            agentId: target.id,
            role: target.label,
            amount: target.label === 'provider' ? escrow.releaseAmount : escrow.project.budgetUsd,
            source: 'vcap-m2m-handshake',
          },
        });
      } catch (err) {
        logger.error('[M2M] trust emit failed for %s (%s): %s', target.label, target.id, (err as Error)?.message);
      }
    }

    logger.info('[M2M] released escrow %s for project %s', escrowId, escrow.project.id);

    return {
      ok: true,
      released: true,
      status: 'RELEASED',
      reason: 'deliverableHash verified — funds released automatically',
      projectId: escrow.project.id,
      escrowId,
      providerId,
      releasedAmount: escrow.releaseAmount,
    };
  }
};
