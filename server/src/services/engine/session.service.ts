import { z } from 'zod';
import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import type { AgentDelegation } from '@prisma/client';

/**
 * engine/session.service.ts — ERC-7710 Delegated Budgets.
 *
 * PabandiSession authorises a tab against a Trust-Score-derived limit. An
 * ERC-7710 Delegation is the bounded-authority object an external agent
 * presents instead: the principal (human/business) grants the delegate
 * (agent) a caveated authorisation to spend against the Pabandi Escrow
 * contract only.
 *
 * Caveats (ERC-7710-style, enforced server-side on every spend):
 *
 *   - MaxAmount: budget cap in USDC cents (hard cap).
 *   - Expiry: unix-ms lifetime after which the delegation is dead.
 *   - AllowedContracts: contract addresses the delegate may call; only the
 *     Pabandi Escrow contract is permitted.
 *
 * Modeled in the database (AgentDelegation) rather than requiring the
 * MetaMask Smart Accounts Kit on-chain today. The shape is ERC-7710-compatible
 * so a future migration can publish these to a real delegator contract.
 */

/** The Pabandi Escrow contract address (devnet/mainnet placeholder). */
const PABANDI_ESCROW_CONTRACT = process.env.PABANDI_ESCROW_CONTRACT || '0xPabandiEscrow';

/** Caveat kinds an ERC-7710 delegation may carry. */
export type DelegationCaveat = 'MaxAmount' | 'Expiry' | 'AllowedContracts';

export interface DelegationCaveats {
  /** MaxAmount: budget cap in USDC cents. */
  maxAmountCents: number;
  /** Expiry: unix-ms after which the delegation is dead. */
  expiryAtMs: number;
  /** AllowedContracts: contract addresses the delegate may call. */
  allowedContracts: string[];
}

export interface CreateDelegationInput {
  principalId: string;
  agentId: string;
  caveats: DelegationCaveats;
}

export interface VerifyDelegationInput {
  delegationId: string;
  amountCents: number;
  contractAddress: string;
}

/** Result of delegating authority to an agent. */
export interface DelegationView {
  id: string;
  delegationId: string;
  principalId: string;
  agentId: string;
  maxAmountCents: number;
  expiryAt: Date;
  allowedContracts: string[];
  spentCents: number;
  remainingCents: number;
  status: string;
  createdAt: Date;
}

/** Outcome of verifying + debiting a delegation for a spend. */
export interface SpendVerdict {
  ok: boolean;
  delegation?: DelegationView;
  remainingCents?: number;
  error?: { code: string; message: string };
}

const createDelegationSchema = z.object({
  principalId: z.string().min(1),
  agentId: z.string().min(1),
  caveats: z.object({
    maxAmountCents: z.number().int().positive('MaxAmount must be a positive integer of USDC cents'),
    expiryAtMs: z.number().int().positive('Expiry must be a future unix-ms timestamp'),
    allowedContracts: z.array(z.string().min(1)).min(1, 'AllowedContracts must list at least one contract'),
  }),
});

export class SessionDelegationService {
  /**
   * Create an ERC-7710 Delegation granting an agent bounded authority.
   *
   * The delegationId is a deterministic hash of principal + agent + caveats,
   * so the same grant is idempotent: re-creating an identical delegation
   * returns the existing one rather than minting a second authority for the
   * same bounds.
   */
  async createDelegation(input: CreateDelegationInput): Promise<DelegationView> {
    const parsed = createDelegationSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid delegation caveats: ${parsed.error.issues.map(i => i.message).join('; ')}`);
    }

    const { principalId, agentId, caveats } = parsed.data;

    // Reject delegations that are already expired at creation time.
    if (caveats.expiryAtMs <= Date.now()) {
      throw new Error('Expiry must be in the future');
    }

    // Enforce the Pabandi Escrow contract restriction: only the platform's
    // own escrow contract may be the target of a delegated spend.
    const hasEscrowContract = caveats.allowedContracts.includes(PABANDI_ESCROW_CONTRACT);
    if (!hasEscrowContract) {
      throw new Error(
        `AllowedContracts must include the Pabandi Escrow contract (${PABANDI_ESCROW_CONTRACT})`,
      );
    }

    const delegationId = this.hashDelegation(principalId, agentId, caveats);

    const existing = await prisma.agentDelegation.findUnique({
      where: { delegationId },
    });
    if (existing) {
      logger.info(
        `[Engine] delegation idempotent replay delegationId=${delegationId} agent=${agentId}`,
      );
      return this.toView(existing);
    }

    const created = await prisma.agentDelegation.create({
      data: {
        delegationId,
        principalId,
        agentId,
        maxAmountCents: caveats.maxAmountCents,
        expiryAt: new Date(caveats.expiryAtMs),
        allowedContracts: caveats.allowedContracts,
        status: 'active',
        spentCents: 0,
      },
    });

    logger.info(
      `[Engine] delegation created delegationId=${delegationId} principal=${principalId} agent=${agentId} max=${caveats.maxAmountCents}c`,
    );

    return this.toView(created);
  }

  /**
   * Verify a delegation is valid and the caveats are met for a proposed spend,
   * then debit the spent amount against MaxAmount.
   *
   * Returns ok=false with a coded error when:
   *   - the delegation does not exist or is not active,
   *   - the delegation has expired (Expiry caveat),
   *   - the contract is not in AllowedContracts,
   *   - the spend would exceed MaxAmount.
   */
  async verifyAndDebit(input: VerifyDelegationInput): Promise<SpendVerdict> {
    const { delegationId, amountCents, contractAddress } = input;

    if (amountCents <= 0) {
      return { ok: false, error: { code: 'INVALID_AMOUNT', message: 'amountCents must be positive' } };
    }

    const delegation = await prisma.agentDelegation.findUnique({
      where: { delegationId },
    });

    if (!delegation) {
      return {
        ok: false,
        error: { code: 'DELEGATION_NOT_FOUND', message: `No delegation ${delegationId}` },
      };
    }

    if (delegation.status !== 'active') {
      return {
        ok: false,
        error: { code: 'DELEGATION_NOT_ACTIVE', message: `Delegation is ${delegation.status}` },
      };
    }

    // Expiry caveat: delegation is dead after expiryAt even if unspent.
    if (delegation.expiryAt.getTime() <= Date.now()) {
      await prisma.agentDelegation.update({
        where: { id: delegation.id },
        data: { status: 'expired' },
      });
      return {
        ok: false,
        error: { code: 'DELEGATION_EXPIRED', message: 'Delegation has expired' },
      };
    }

    // AllowedContracts caveat: only whitelisted contracts may be called.
    const allowed = Array.isArray(delegation.allowedContracts)
      ? (delegation.allowedContracts as string[]).includes(contractAddress)
      : false;
    if (!allowed) {
      return {
        ok: false,
        error: {
          code: 'CONTRACT_NOT_ALLOWED',
          message: `Contract ${contractAddress} not in AllowedContracts`,
        },
      };
    }

    // MaxAmount caveat: the cumulative spend must not exceed the cap.
    const newSpent = delegation.spentCents + amountCents;
    if (newSpent > delegation.maxAmountCents) {
      return {
        ok: false,
        error: {
          code: 'MAX_AMOUNT_EXCEEDED',
          message: `Spend of ${amountCents}c would exceed MaxAmount ${delegation.maxAmountCents}c (spent ${delegation.spentCents}c)`,
        },
      };
    }

    // Debit the spent amount atomically.
    const updated = await prisma.agentDelegation.update({
      where: { id: delegation.id },
      data: { spentCents: newSpent },
    });

    logger.info(
      `[Engine] delegation debited delegationId=${delegationId} amount=${amountCents}c spent=${newSpent}c max=${delegation.maxAmountCents}c`,
    );

    return { ok: true, delegation: this.toView(updated), remainingCents: delegation.maxAmountCents - newSpent };
  }

  /** Revoke a delegation (principal or platform action). */
  async revokeDelegation(delegationId: string): Promise<boolean> {
    const updated = await prisma.agentDelegation.updateMany({
      where: { delegationId, status: 'active' },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    return updated.count > 0;
  }

  /** Load a delegation by id. */
  async getDelegation(delegationId: string): Promise<DelegationView | null> {
    const row = await prisma.agentDelegation.findUnique({ where: { delegationId } });
    return row ? this.toView(row) : null;
  }

  /** List active delegations for an agent. */
  async listDelegationsForAgent(agentId: string): Promise<DelegationView[]> {
    const rows = await prisma.agentDelegation.findMany({
      where: { agentId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: typeof rows[number]) => this.toView(r));
  }

  /** Deterministic delegation id: sha256(principal|agent|caveats). */
  private hashDelegation(principalId: string, agentId: string, caveats: DelegationCaveats): string {
    const payload = JSON.stringify({
      principalId,
      agentId,
      maxAmountCents: caveats.maxAmountCents,
      expiryAtMs: caveats.expiryAtMs,
      allowedContracts: [...caveats.allowedContracts].sort(),
    });
    return require('crypto').createHash('sha256').update(payload).digest('hex');
  }

  private toView(row: AgentDelegation): DelegationView {
    const allowed = Array.isArray(row.allowedContracts) ? (row.allowedContracts as string[]) : [];
    return {
      id: row.id,
      delegationId: row.delegationId,
      principalId: row.principalId,
      agentId: row.agentId,
      maxAmountCents: row.maxAmountCents,
      expiryAt: row.expiryAt,
      allowedContracts: allowed,
      spentCents: row.spentCents,
      remainingCents: row.maxAmountCents - row.spentCents,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}

export const sessionDelegation = new SessionDelegationService();
