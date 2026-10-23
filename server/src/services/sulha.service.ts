import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';
import { universalEscrowService } from './universal-escrow.service';
import { engineService } from './engine.service';

/**
 * sulha.service.ts — the dispute record layer for Sulha (Optimistic
 * Arbitration).
 *
 * ─── WHAT SULHA IS ───────────────────────────────────────────────────────
 * "Sulha" is a settlement agreement: the mechanism where parties resolve a
 * disagreement without going to court. On Pabandi, escrowed funds are the
 * deposit that makes it work: until a dispute resolves, the escrow cannot
 * move, and the engine sessions that fund it cannot close.
 *
 * The flow: a party raises a dispute, the escrow freezes (`disputed`), the
 * Jev arbitrator runs (arbitration.service), and either it resolves with high
 * confidence or a staked human panel takes over. The record layer here keeps
 * the state machine and the invariants:
 *
 *   1. One dispute per escrow (`escrowId @unique`).
 *   2. A dispute locks the escrow at `disputed` until resolution.
 *   3. Only the raising passport or a named escrow party may append evidence.
 *   4. An open dispute blocks engine settlement paths that touch it.
 *
 * Deliberately NOT here: the actual evidence adjudication (arbitration
 * service), the on-chain escrow (universal/solana escrow services), and the
 * panel UI (contact/arbitration). This file owns the record and its gates.
 */

/** The statuses a dispute sits in before it is decided. */
export const DISPUTE_OPEN_STATUSES = ['open', 'ai_review', 'human_review'] as const;

export type EscrowDisputeStatus = (typeof DISPUTE_OPEN_STATUSES)[number] | 'resolved_buyer' | 'resolved_seller';

export interface RaiseDisputeInput {
  escrowId: string;
  raisedByPassport: string;
  reason: string;
  evidenceJson: Record<string, unknown>;
  /** The engine session that funds this escrow, if any — informs the close
   * blocker. Optional: disputes raised without a session still arbitrate. */
  sessionId?: string;
}

export interface SulhaDisputeView {
  id: string;
  escrowId: string;
  raisedByPassport: string;
  reason: string;
  evidenceJson: Record<string, unknown>;
  status: string;
  aiConfidence: number | null;
  resolutionNotes: string | null;
  sessionId: string | null;
  panelVotes: unknown;
  createdAt: string;
  resolvedAt: string | null;
}

/** True when the id names an unresolved dispute — the freeze state. */
export async function isEscrowFrozen(escrowId: string): Promise<boolean> {
  const row = await prisma.escrowDispute.findUnique({
    where: { escrowId },
    select: { status: true },
  });
  if (!row) return false;
  return (DISPUTE_OPEN_STATUSES as readonly string[]).includes(row.status);
}

/**
 * True when ANY open dispute references this engine session. The engine's
 * close path calls this instead of reaching into Sulha details: a boolean is
 * enough of a contract for "cannot close while a dispute is open" and keeps
 * the engine from depending on how disputes are represented.
 */
export async function hasOpenDisputeForSession(sessionId: string): Promise<boolean> {
  const count = await prisma.escrowDispute.count({
    where: { sessionId, status: { in: [...DISPUTE_OPEN_STATUSES] } },
  });
  return count > 0;
}

/** The panel-visible projection: what an arbitrator or a party sees. */
export function toDisputeView(row: {
  id: string;
  escrowId: string;
  raisedByPassport: string;
  reason: string;
  evidenceJson: unknown;
  status: string;
  aiConfidence: number | null;
  resolutionNotes: string | null;
  sessionId: string | null;
  panelVotes: unknown;
  createdAt: Date;
  resolvedAt: Date | null;
}): SulhaDisputeView {
  return {
    id: row.id,
    escrowId: row.escrowId,
    raisedByPassport: row.raisedByPassport,
    reason: row.reason,
    evidenceJson: (row.evidenceJson ?? {}) as Record<string, unknown>,
    status: row.status,
    aiConfidence: row.aiConfidence,
    resolutionNotes: row.resolutionNotes,
    sessionId: row.sessionId,
    panelVotes: row.panelVotes,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

export class SulhaService {
  /** Thin expose of the projection for routes that read raw rows. */
  toView(row: Parameters<typeof toDisputeView>[0]): SulhaDisputeView {
    return toDisputeView(row);
  }

  /**
   * Raise a dispute and freeze the escrow.
   *
   * The escrow lookup is the guard against disputing nothing: there is no
   * dispute for an escrow that does not exist, and pointing that out early is
   * kinder than arbitrating a phantom.
   */
  async raiseDispute(input: RaiseDisputeInput): Promise<SulhaDisputeView> {
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: input.escrowId },
      select: { referenceId: true, status: true },
    });
    if (!escrow) {
      throw new SulhaError('ESCROW_NOT_FOUND', `No escrow ${input.escrowId} exists`);
    }
    // A terminal escrow has no disputed funds — disputing it would open a
    // case about money that is already paid out, so the invitation is refused
    // rather than filed.
    if (['released', 'refunded'].includes(escrow.status)) {
      throw new SulhaError('ESCROW_NOT_DISPUTABLE', `Escrow ${input.escrowId} is ${escrow.status}; nothing to freeze`);
    }

    const created = await prisma.escrowDispute
      .create({
        data: {
          escrowId: input.escrowId,
          raisedByPassport: input.raisedByPassport,
          reason: input.reason,
          evidenceJson: input.evidenceJson as object,
          sessionId: input.sessionId ?? null,
          status: 'open',
        },
      })
      .catch((err: unknown) => {
        // The unique index is the real race guard: two parties raising on the
        // same escrow concurrently both pass the existence check above, and the
        // loser lands here. Surfacing P2002 as a typed error is friendlier than
        // a 500 — the same pattern trust-core uses for idempotent repeats.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new SulhaError(
            'DISPUTE_ALREADY_OPEN',
            `Escrow ${input.escrowId} already has a dispute`
          );
        }
        throw err;
      });

    // ── Freeze via the escrow state machine ────────────────────────────────
    // universalEscrowService.updateStatus, not a blind write: it validates the
    // current state (frozen only from a live status), refuses illegal moves,
    // and emits the `escrow.disputed` trust events the trust layer already
    // audits. Bypassing it here would fork escrow lifecycle invariants and
    // skip the negative trust signal a dispute carries.
    await universalEscrowService.updateStatus(input.escrowId, 'disputed');

    logger.info(
      `[Sulha] dispute raised disputeId=${created.id} escrow=${input.escrowId} by=${input.raisedByPassport}`
    );
    return toDisputeView(created);
  }

  /** Dispute status — the counterparty's "has this resolved yet?" read. */
  async getDispute(id: string): Promise<SulhaDisputeView | null> {
    const row = await prisma.escrowDispute.findUnique({ where: { id } });
    return row ? toDisputeView(row) : null;
  }

  /**
   * Whether the escrow should unfreeze to `released` (seller keeps the funds)
   * or `refunded` (buyer gets them back). The two verdicts Sulha can read.
   */
  static verdictToEscrowStatus(verdict: 'buyer' | 'seller'): string {
    return verdict === 'buyer' ? 'refunded' : 'released';
  }

  /**
   * Settle a dispute: record the resolution, unfreeze and move the escrow to
   * its post-verdict status, close the funding engine session, and fire trust
   * events for both parties.
   *
   * Called by the Jev arbitrator (arbitration.service) when confidence is
   * decisive and by the staked panel (panel resolve endpoint) when a human
   * has reviewed — both paths land here so the settlement semantics, the
   * escrow transition, and the trust audit are one code path rather than two
   * drift-prone copies.
   */
  async settleDispute(input: {
    disputeId: string;
    verdict: 'buyer' | 'seller';
    /** Human- or machine-readable notes audited next to the record. */
    resolutionNotes: string;
    confidence?: number | null;
    source: 'ai' | 'panel';
  }): Promise<SulhaDisputeView> {
    const row = await prisma.escrowDispute.findUnique({
      where: { id: input.disputeId },
      select: { id: true, status: true, escrowId: true, sessionId: true, raisedByPassport: true },
    });
    if (!row) throw new SulhaError('DISPUTE_NOT_FOUND', `No dispute ${input.disputeId}`);
    if (row.status.startsWith('resolved')) {
      throw new SulhaError('DISPUTE_ALREADY_RESOLVED', `Dispute ${input.disputeId} already settled`);
    }

    const status = input.verdict === 'buyer' ? 'resolved_buyer' : 'resolved_seller';
    const escrowStatus = SulhaService.verdictToEscrowStatus(input.verdict);

    const updated = await prisma.escrowDispute.update({
      where: { id: row.id },
      data: {
        status,
        aiConfidence: input.confidence ?? undefined,
        resolutionNotes: input.resolutionNotes,
        resolvedAt: new Date(),
      },
    });

    // ── Unfreeze escrow to its verdict state ───────────────────────────────
    // universalEscrowService.updateStatus is the same transition the rest of
    // the platform uses; bypassing it would fork escrow lifecycle invariants.
    try {
      await universalEscrowService.updateStatus(row.escrowId, escrowStatus);
    } catch (err: unknown) {
      // The dispute record is the source of truth for once-settled; a failed
      // escrow transition is retried by escrow reconcilers and must not roll
      // the resolution back (that would un-settle an already-public decision).
      logger.error(`[Sulha] escrow status update failed for ${row.escrowId} -> ${escrowStatus}: ${String(err)}`);
    }

    // ── Close the funding engine session ──────────────────────────────────
    // With the dispute closed and the verdict recorded, the session that
    // funded the escrow may now settle: the blocker is lifted exactly because
    // the dispute is resolved.
    if (row.sessionId) {
      const settle = await engineService.closeSession(row.sessionId, true);
      if (!settle.ok) {
        logger.warn(
          `[Sulha] engine settlement deferred for session ${row.sessionId}: ${settle.error.code}`
        );
      }
    }

    // ── Trust events ───────────────────────────────────────────────────────
    // The counterparty passport ids come from the escrow's party list, but a
    // partyId is only a passport when it names a TrustPassport row — other
    // callers put user ids there. Emitting with a nonexistent passport would
    // FK-fail the trust event and abort a settlement that is already public,
    // so each candidate is resolved to a real passport first: a real one gets
    // the scored event, everything else gets nothing rather than a crash.
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: row.escrowId },
      select: { parties: true },
    });
    const parties = Array.isArray(escrow?.parties) ? (escrow?.parties as Array<{ partyId: string; role?: string }>) : [];
    const resolvePassport = async (partyId: string | undefined): Promise<string | null> => {
      if (!partyId) return null;
      const passport = await prisma.trustPassport.findUnique({ where: { id: partyId }, select: { id: true } });
      return passport?.id ?? null;
    };
    const sellerPassport = await resolvePassport(parties.find((p) => p.role === 'seller')?.partyId);
    const buyerPassport = await resolvePassport(parties.find((p) => p.role === 'buyer')?.partyId);

    // winner gains, loser fails — same pair of signals whatever the verdict.
    const winner = input.verdict === 'seller' ? sellerPassport : buyerPassport;
    const loser = input.verdict === 'seller' ? buyerPassport : sellerPassport;
    const eventType = input.verdict === 'seller' ? 'dispute.resolved_seller' : 'dispute.resolved_buyer';
    if (winner) {
      await trustCore.emit(eventType, { passportId: winner, disputeId: row.id, escrowId: row.escrowId, source: input.source });
    }
    if (loser) {
      await trustCore.emit('dispute.failed', { passportId: loser, disputeId: row.id, escrowId: row.escrowId, source: input.source });
    }

    logger.info(
      `[Sulha] dispute settled disputeId=${row.id} verdict=${input.verdict} by=${input.source} escrow=${row.escrowId}`
    );
    return toDisputeView(updated);
  }

  /**
   * Append evidence without losing what came before. Postgres `Json` is not
   * mergeable in a single update, so this is a deliberate
   * read-merge-write-and-append:
   *   { original: <first raise body>, appended: [ {passportId, evidence, at} ] }
   * The list is append-only; a re-read never rewrites history already given to
   * the arbitrator.
   *
   * Permission: the raising passport, or a named party on the escrow.
   */
  async appendEvidence(
    id: string,
    passportId: string,
    evidence: Record<string, unknown>
  ): Promise<SulhaDisputeView> {
    const row = await prisma.escrowDispute.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        raisedByPassport: true,
        escrowId: true,
        evidenceJson: true,
      },
    });
    if (!row) throw new SulhaError('DISPUTE_NOT_FOUND', `No dispute ${id}`);
    if (row.status.startsWith('resolved')) {
      throw new SulhaError('DISPUTE_ALREADY_RESOLVED', `Dispute ${id} is already resolved`);
    }

    // Same gate as raise: a passport not connected to this dispute has no case
    // to strengthen, and letting it add "evidence" would let anyone edit the
    // record the arbitrator reads.
    const allowed = await this.isPartyToDispute(row, passportId);
    if (!allowed) {
      throw new SulhaError('NOT_A_PARTY', `${passportId} is not the raiser or a named party on escrow ${row.escrowId}`);
    }

    const prior = (row.evidenceJson ?? {}) as Record<string, unknown>;
    const appended = Array.isArray(prior.appended) ? (prior.appended as unknown[]) : [];
    const mergedEvidence = {
      ...prior,
      // The original raise body is preserved verbatim under `original` so a
      // later reader always sees it even as appended layers grow.
      original: prior.original ?? stripAppended(prior),
      appended: [...appended, { passportId, evidence, at: new Date().toISOString() }],
    };

    const updated = await prisma.escrowDispute.update({
      where: { id },
      data: { evidenceJson: JSON.parse(JSON.stringify(mergedEvidence)) as object },
    });
    return toDisputeView(updated);
  }

  /**
   * The raiser always may append. Any other passport must be named on the
   * escrow it disputes — `UniversalEscrow.parties` is the Json party list the
   * escrow API already authored ({ partyId, role }), so that same list is the
   * permission table rather than inventing a second one.
   */
  private async isPartyToDispute(
    row: { raisedByPassport: string; escrowId: string },
    passportId: string
  ): Promise<boolean> {
    if (row.raisedByPassport === passportId) return true;
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: row.escrowId },
      select: { parties: true },
    });
    if (!escrow || !Array.isArray(escrow.parties)) return false;
    return (escrow.parties as Array<{ partyId?: string }>).some((p) => p && p.partyId === passportId);
  }
}

/** Raise-body reconstruction for the `original` field on first append. */
function stripAppended(prior: Record<string, unknown>): Record<string, unknown> {
  const { appended: _appended, original: _original, ...rest } = prior;
  return rest;
}

/** Typed errors the routes turn into status codes rather than 500s. */
export class SulhaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const sulhaService = new SulhaService();
