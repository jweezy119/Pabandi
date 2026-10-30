import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { evaluateBookingDeposit } from './engine-deposit.service';
import type { DepositRequirement } from './engine-deposit.service';

/**
 * Pabandi Engine -- session abstraction.
 *
 * Signing a transaction per action is the thing this exists to remove. A user
 * or agent opens a session once, authorised against a limit that their Trust
 * Score determines, and then spends repeatedly against it without a further
 * signature. The signature captured at open time stands in for every signature
 * it replaces.
 *
 * ─── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * Nothing in this file touches Solana. A session is a database row recording
 * what has been promised; the `signature` on each receipt is a digest binding
 * the action to the session, not an on-chain authorisation and not a proof of
 * funds. Balances here are promises until `closeSession` settles them, and
 * callers that present these figures to a third party as settled money are
 * wrong. Settlement lands in Phase 4; until then `settledAt` stays null and
 * `status` is the only truth about a session.
 *
 * ─── WHY FLOAT, THOUGH ──────────────────────────────────────────────────────
 * Float is the wrong type for money and is used throughout this schema
 * already (Invoice.subtotal, CrmClient.totalSpent, Business.depositAmount).
 * Introducing Decimal here would make PabandiSession the only place arithmetic
 * is exact and guarantee a rounding bug at the boundary. All comparisons are
 * therefore done on integers of cents via `toCents`/`fromCents` rather than on
 * the floats directly -- `0.1 + 0.2 !== 0.3` must not be able to make a session
 * overspend or a receipt appear to not exist.
 */

// ── Limits ───────────────────────────────────────────────────────────────────

export interface SessionTier {
  name: string;
  /** Minimum Trust Score for this tier. */
  minScore: number;
  totalLimit: number;
  ttlHours: number;
}

/**
 * The tier schedule, highest first. 800+ gets the long, large tab; below 500
 * gets a small one that expires in a day.
 *
 * Ordered highest-first and matched with a linear scan on purpose. Three tiers
 * do not need a binary search, and a table this short is readable in a way
 * that a scoring formula is not.
 */
export const SESSION_TIERS: readonly SessionTier[] = [
  { name: 'established', minScore: 800, totalLimit: 1000, ttlHours: 24 * 30 },
  { name: 'established_7d', minScore: 500, totalLimit: 100, ttlHours: 24 * 7 },
  { name: 'unproven', minScore: 0, totalLimit: 20, ttlHours: 24 },
] as const;

export function tierForScore(trustScore: number): SessionTier {
  for (const tier of SESSION_TIERS) {
    if (trustScore >= tier.minScore) {
      return tier;
    }
  }
  // Unreachable: the last tier has minScore 0 and every finite number clears
  // it. Present so a future edit to SESSION_TIERS that leaves a gap is a
  // compile-visible thought rather than an implicit `undefined`.
  return SESSION_TIERS[SESSION_TIERS.length - 1]!;
}

// ── Money helpers ────────────────────────────────────────────────────────────

/** Round to cents. Every limit comparison goes through this. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

// ── Results ──────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'pending' | 'closed' | 'exhausted';

export interface OpenSessionResult {
  sessionId: string;
  ownerType: string;
  ownerId: string;
  ephemeralKey: string;
  totalLimit: number;
  spent: number;
  remaining: number;
  currency: string;
  status: SessionStatus;
  tier: string;
  expiresAt: string;
}

export interface ReceiptView {
  id: string;
  actionType: string;
  amount: number;
  payloadHash: string;
  signature: string;
  createdAt: string;
}

export interface ExecuteResult {
  receipt: ReceiptView;
  session: {
    id: string;
    spent: number;
    totalLimit: number;
    remaining: number;
    status: SessionStatus;
    expiresAt: string;
  };
  /**
   * Whether the caller must take a further on-chain step. `none` means the
   * session covered it. Phase 5 reads this to decide between a success toast
   * and an embedded deposit prompt, so the value is set deliberately rather
   * than left as a placeholder.
   */
  actionRequired: 'none' | 'deposit_required';
  /**
   * What the user must fund before the booking settles, when the business
   * asks for one. Only set for `actionType: 'booking'` actions whose payload
   * names a business, and only when the server-side policy actually demands
   * it — the caller's deposit arithmetic, wherever it used to happen, is
   * subordinate to what this field says.
   */
  deposit?: DepositRequirement | null;
  idempotentReplay: boolean;
}

export type ExecuteFailure =
  | { code: 'SESSION_NOT_FOUND'; message: string }
  | { code: 'SESSION_NOT_ACTIVE'; message: string; status: SessionStatus }
  | { code: 'SESSION_EXPIRED'; message: string }
  | { code: 'LIMIT_EXCEEDED'; message: string; spent: number; totalLimit: number; requested: number }
  | { code: 'SESSION_DISPUTED'; message: string; disputeId: string }
  | { code: 'CONCURRENT_SPEND'; message: string }
  | { code: 'INVALID_AMOUNT'; message: string };

export type ExecuteOutcome =
  | { ok: true; value: ExecuteResult }
  | { ok: false; error: ExecuteFailure };

// ── Signature ────────────────────────────────────────────────────────────────

/**
 * Stable stringify: object keys sorted at every depth, so that two payloads
 * that differ only in key order hash identically. Without this an agent that
 * retries with a re-serialised body would produce a different payloadHash for
 * the same action and defeat the idempotency check.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(',')}}`;
}

export function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(canonicalise(payload)).digest('hex');
}

/**
 * The receipt's signature. Deliberately not an asymmetric signature over the
 * private ephemeral key: this binds the receipt to the session id and the
 * amount, which is what a receipt is for, and does not pretend to be an
 * on-chain authorisation that the rest of the system would then have to
 * verify. When settlement lands, this is the field that has to become a real
 * signature and it will be obvious from here that nothing has depended on it
 * being one already.
 */
function signReceipt(sessionId: string, amountCents: number, payloadHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`${sessionId}:${amountCents}:${payloadHash}`)
    .digest('hex');
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface ExecuteInput {
  sessionId: string;
  actionType: string;
  amount: number;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

class EngineService {
  /**
   * Open a tab sized by the caller's Trust Score.
   *
   * The score is a parameter rather than something looked up here on purpose:
   * this function does not know whether the caller is a User or a Web3Agent,
   * and those resolve their Trust Score from different columns. Passing it in
   * keeps the tier policy in one place -- `tierForScore` -- instead of spread
   * across two lookup paths that could disagree about who gets $1000.
   *
   * Callers on the HTTP path must resolve the score server-side. Phase 2's
   * route does not yet do this for agents without a passport, and that gap is
   * called out where the route is written rather than papered over here.
   */
  async openSession(
    ownerType: 'user' | 'agent',
    ownerId: string,
    trustScore: number
  ): Promise<OpenSessionResult> {
    const tier = tierForScore(trustScore);
    const ephemeralKey = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + tier.ttlHours * 60 * 60 * 1000);

    const session = await prisma.pabandiSession.create({
      data: {
        ownerType,
        ownerId,
        ephemeralKey,
        totalLimit: tier.totalLimit,
        spent: 0,
        status: 'active',
        expiresAt,
      },
      select: {
        id: true,
        ephemeralKey: true,
        totalLimit: true,
        spent: true,
        currency: true,
        status: true,
        expiresAt: true,
      },
    });

    logger.info(
      `[Engine] session opened ${session.id} owner=${ownerType}:${ownerId} tier=${tier.name} limit=${tier.totalLimit}`
    );

    return {
      sessionId: session.id,
      ownerType,
      ownerId,
      ephemeralKey: session.ephemeralKey,
      totalLimit: session.totalLimit,
      spent: session.spent,
      remaining: fromCents(toCents(session.totalLimit) - toCents(session.spent)),
      currency: session.currency,
      status: session.status as SessionStatus,
      tier: tier.name,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Spend against an open session.
   *
   * The balance check and the deduction are one conditional UPDATE, not a read
   * followed by a write. That is deliberate and is the part that matters:
   * `spent + amount <= totalLimit` evaluated in the WHERE clause means two
   * concurrent actions against the same session cannot both pass a check that
   * each saw as true. Read-then-write would let both succeed and drive the
   * session negative, which on a spend cap is the bug that matters most.
   *
   * Ids and amounts are compared as integer cents throughout; see the note at
   * the top of this file.
   */
  async executeTransaction(input: ExecuteInput): Promise<ExecuteOutcome> {
    const amountCents = toCents(input.amount);

    if (input.amount <= 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'amount must be greater than zero',
        },
      };
    }

    const payloadHash = hashPayload(input.payload);

    // Replay: an idempotency key that has already been spent returns the
    // original receipt rather than spending again. Checked before the balance
    // read because a retry after a successful-but-unacknowledged call should
    // succeed even if the session has since been exhausted.
    if (input.idempotencyKey) {
      const existing = await prisma.sessionReceipt.findFirst({
        where: { sessionId: input.sessionId, idempotencyKey: input.idempotencyKey },
      });

      if (existing) {
        const session = await prisma.pabandiSession.findUnique({
          where: { id: input.sessionId },
          select: { id: true, spent: true, totalLimit: true, status: true, expiresAt: true },
        });

        if (!session) {
          return {
            ok: false,
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          };
        }

        return {
          ok: true,
          value: {
            receipt: this.toReceiptView(existing),
            session: this.toSessionView(session),
            // A replay is the caller's own retry of an action already
            // authorised against the tab. Answering 'none' is deliberate and
            // is what makes the post-deposit flow work: the client re-runs the
            // booking after funding the deposit, this replay returns the
            // original receipt with no further ask, and the retry confirms.
            actionRequired: 'none',
            idempotentReplay: true,
          },
        };
      }
    }

    const session = await prisma.pabandiSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        spent: true,
        totalLimit: true,
        status: true,
        expiresAt: true,
        // Needed by the deposit policy, which prices the ask against the
        // principal's own score rather than the session's tier.
        ownerType: true,
        ownerId: true,
      },
    });

    if (!session) {
      return {
        ok: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      // Mark it, so the state stops reading as active. Best-effort: a failure
      // here must not mask the expiry itself, which is the real answer.
      await prisma.pabandiSession
        .updateMany({
          where: { id: session.id, status: 'active' },
          data: { status: 'closed', closedAt: new Date() },
        })
        .catch((err: unknown) => {
          logger.warn(`[Engine] failed to mark expired session ${session.id}: ${String(err)}`);
        });

      return {
        ok: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      };
    }

    if (session.status !== 'active') {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_ACTIVE',
          message: `Session is ${session.status}`,
          status: session.status as SessionStatus,
        },
      };
    }

    // Atomic conditional debit. spent and totalLimit are floats in the schema,
    // so the guard is expressed in cents as `round(spent*100) + :amount <=
    // round(totalLimit*100)`. The predicate and the increment are the same
    // statement, which is what makes concurrent spends safe.
    const updated = await prisma.$queryRaw<
      Array<{ id: string; spent: number; totalLimit: number; status: string; expiresAt: Date }>
    >`
      UPDATE "PabandiSession"
      SET "spent" = "spent" + ${fromCents(amountCents)},
          "updatedAt" = NOW(),
          "status" = CASE
            WHEN ROUND(("spent" + ${fromCents(amountCents)})::numeric * 100)::int
                 >= ROUND("totalLimit"::numeric * 100)::int
            THEN 'exhausted'
            ELSE "status"
          END
      WHERE "id" = ${input.sessionId}
        AND "status" = 'active'
        AND "expiresAt" > NOW()
        AND ROUND("spent"::numeric * 100)::int + ${amountCents}
            <= ROUND("totalLimit"::numeric * 100)::int
      RETURNING "id", "spent", "totalLimit", "status", "expiresAt"
    `;

    if (updated.length === 0) {
      // The conditional update matched nothing. Distinguish "ran out of room"
      // from "someone closed it underneath us" by re-reading, so the caller is
      // told which happened rather than getting a bare failure.
      const current = await prisma.pabandiSession.findUnique({
        where: { id: input.sessionId },
        select: { spent: true, totalLimit: true, status: true, expiresAt: true },
      });

      if (!current) {
        return {
          ok: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        };
      }

      if (current.status === 'closed' || current.expiresAt.getTime() <= Date.now()) {
        return {
          ok: false,
          error: {
            code: 'SESSION_NOT_ACTIVE',
            message: `Session is ${current.status}`,
            status: current.status as SessionStatus,
          },
        };
      }

      return {
        ok: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: 'Session limit exceeded',
          spent: current.spent,
          totalLimit: current.totalLimit,
          requested: input.amount,
        },
      };
    }

    const row = updated[0]!;

    let receipt;
    try {
      receipt = await prisma.sessionReceipt.create({
        data: {
          sessionId: row.id,
          actionType: input.actionType,
          amount: input.amount,
          payloadHash,
          signature: signReceipt(row.id, amountCents, payloadHash),
          idempotencyKey: input.idempotencyKey ?? null,
        },
        select: { id: true, actionType: true, amount: true, payloadHash: true, signature: true, createdAt: true },
      });
    } catch (err: unknown) {
      // The balance was already debited. Give it back rather than leaving the
      // session short by an action that produced no receipt. A concurrent
      // identical idempotencyKey losing this race hits the unique index here,
      // so the money is returned and the retry resolves to the winner.
      await this.credit(row.id, amountCents, 'receipt-create-failed');
      logger.error(`[Engine] receipt creation failed for session ${row.id}: ${String(err)}`);
      return {
        ok: false,
        error: { code: 'CONCURRENT_SPEND', message: 'Could not record receipt; session balance restored' },
      };
    }

    // ── DEPOSIT POLICY, SERVER-SIDE ───────────────────────────────────────────
    // A booking may still owe a deposit. The policy answer comes from the
    // server (engine-deposit.service), never from the caller, so a client that
    // computes "my score is high enough to skip this" is overruled by a field
    // it only reads. Runs after the debit has fully settled: the session
    // authorisation and the business's deposit ask are separate questions, and
    // the second must not be able to roll back the first.
    let deposit: DepositRequirement | null = null;
    let actionRequired: 'none' | 'deposit_required' = 'none';

    if (input.actionType === 'booking') {
      const businessId = typeof input.payload.businessId === 'string' ? input.payload.businessId : '';
      if (businessId) {
        try {
          const decision = await evaluateBookingDeposit({
            businessId,
            ownerType: session.ownerType as 'user' | 'agent',
            ownerId: session.ownerId,
            bookingValue: input.amount,
          });

          if (decision.required && decision.deposit) {
            deposit = decision.deposit;
            actionRequired = 'deposit_required';
          }
        } catch (err: unknown) {
          // The session charge stands regardless. Skipping the deposit on an
          // internal error is the honest reading of "could not evaluate" —
          // no checkout URL can be demanded of a caller when the server could
          // not work out whether one is owed — but it is logged, because a
          // policy silently skipped is a policy quietly gone.
          logger.warn(
            `[Engine] deposit evaluation failed for session ${row.id} business ${businessId}: ${String(err)}`
          );
        }
      }
    }

    return {
      ok: true,
      value: {
        receipt: this.toReceiptView(receipt),
        session: {
          id: row.id,
          spent: row.spent,
          totalLimit: row.totalLimit,
          remaining: fromCents(toCents(row.totalLimit) - toCents(row.spent)),
          status: row.status as SessionStatus,
          expiresAt: row.expiresAt.toISOString(),
        },
        actionRequired,
        deposit,
        idempotentReplay: false,
      },
    };
  }

  /**
   * Return an amount to a session. Used only to undo a debit whose receipt
   * could not be written; the conditional keeps it from crediting a session
   * that has been closed in the meantime.
   */
  private async credit(sessionId: string, amountCents: number, reason: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "PabandiSession"
      SET "spent" = GREATEST("spent" - ${fromCents(amountCents)}, 0),
          "status" = CASE WHEN "status" = 'exhausted' THEN 'active' ELSE "status" END,
          "updatedAt" = NOW()
      WHERE "id" = ${sessionId}
    `;
    logger.warn(`[Engine] credited ${fromCents(amountCents)} back to session ${sessionId} (${reason})`);
  }

  /**
   * Close a session. Marks it closed and reports what is owed.
   *
   * Returns `settlementRequired` rather than settling. Phase 4 owns the
   * on-chain transfer and the x402 debit path; until that exists, closing a
   * session records the liability and says so, instead of reporting a transfer
   * that did not happen.
   */
  async closeSession(
    sessionId: string,
    settle = false
  ): Promise<{ ok: true; value: CloseResult } | { ok: false; error: ExecuteFailure }> {
    const session = await prisma.pabandiSession.findUnique({
      where: { id: sessionId },
      select: { id: true, spent: true, totalLimit: true, status: true, expiresAt: true, closedAt: true },
    });

    if (!session) {
      return { ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } };
    }

    // ─── SULHA FREEZE ──────────────────────────────────────────────────────
    // Closing settles what the session owes. If an escrow dispute funded by
    // this session is open, settlement is precisely what the dispute is about
    // — closing the session now would settle funds before the arbitrator has
    // heard the case. Failure closes the dispute, which is the only way back
    // to a closeable session; the resolution path in sulha.service calls in
    // here after the verdict, so the same gate both blocks and unblocks.
    const openDispute = await prisma.escrowDispute.findFirst({
      where: { sessionId, status: { in: ['open', 'ai_review', 'human_review'] } },
      select: { id: true, escrowId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (openDispute) {
      return {
        ok: false,
        error: {
          code: 'SESSION_DISPUTED',
          message: `Session is frozen: dispute ${openDispute.id} covers escrow ${openDispute.escrowId}`,
          disputeId: openDispute.id,
        },
      };
    }

    const remaining = fromCents(toCents(session.totalLimit) - toCents(session.spent));

    await prisma.pabandiSession.update({
      where: { id: sessionId },
      data: { status: 'closed', closedAt: session.closedAt ?? new Date() },
    });

    const receiptCount = await prisma.sessionReceipt.count({ where: { sessionId } });

    return {
      ok: true,
      value: {
        sessionId,
        status: 'closed' as SessionStatus,
        spent: session.spent,
        unsettledAmount: remaining,
        currency: 'USDC',
        receiptCount,
        settled: false,
        settlementRequired: settle,
        settledAt: null,
      },
    };
  }

  /** Receipts for a session, newest first. */
  async listReceipts(sessionId: string, limit = 50) {
    const rows = await prisma.sessionReceipt.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, actionType: true, amount: true, payloadHash: true, signature: true, createdAt: true },
    });

    return rows.map((row) => this.toReceiptView(row));
  }

  /**
   * Owner-scoped session list for wallet UIs. The wallet must show the account
   * history of tab activity without granting spend authority over anything:
   * this read selects no key material — resolution of a session needs its id,
   * and possession of an id alone does not authorise a spend (spend checks the
   * ephemeral signature). Plain read, so it is unit-testable without a queue.
   */
  async listSessionsForOwner(ownerId: string, limit = 10) {
    const rows = await prisma.pabandiSession.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        ownerType: true,
        totalLimit: true,
        spent: true,
        status: true,
        currency: true,
        createdAt: true,
        expiresAt: true,
        closedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      totalLimit: row.totalLimit,
      spent: row.spent,
      remaining: fromCents(toCents(row.totalLimit) - toCents(row.spent)),
      status: row.status as SessionStatus,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    }));
  }

  /**
   * Recent receipts across an owner's sessions — the wallet's activity feed.
   * Flattens the receipts of every session the owner opened, newest first.
   */
  async listReceiptsForOwner(ownerId: string, limit = 20) {
    const sessions = await prisma.pabandiSession.findMany({
      where: { ownerId },
      select: { id: true },
    });
    if (sessions.length === 0) return [];

    const rows = await prisma.sessionReceipt.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, sessionId: true, actionType: true, amount: true, payloadHash: true, signature: true, createdAt: true },
    });

    return rows.map((row) => ({ ...this.toReceiptView(row), sessionId: row.sessionId }));
  }

  /**
   * Sessions past their expiry that were never settled. This is the work the
   * Phase 3 worker runs; it is a plain read so it can be unit-tested without a
   * queue.
   */
  async findSettleableSessions(now = new Date(), take = 100) {
    return prisma.pabandiSession.findMany({
      where: {
        status: 'active',
        expiresAt: { lte: now },
        settledAt: null,
      },
      orderBy: { expiresAt: 'asc' },
      take,
      select: { id: true, ownerId: true, spent: true, totalLimit: true, currency: true },
    });
  }

  private toReceiptView(row: {
    id: string;
    actionType: string;
    amount: number;
    payloadHash: string;
    signature: string;
    createdAt: Date;
  }): ReceiptView {
    return {
      id: row.id,
      actionType: row.actionType,
      amount: row.amount,
      payloadHash: row.payloadHash,
      signature: row.signature,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toSessionView(row: { id: string; spent: number; totalLimit: number; status: string; expiresAt: Date }) {
    return {
      id: row.id,
      spent: row.spent,
      totalLimit: row.totalLimit,
      remaining: fromCents(toCents(row.totalLimit) - toCents(row.spent)),
      status: row.status as SessionStatus,
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}

export interface CloseResult {
  sessionId: string;
  status: SessionStatus;
  spent: number;
  /** Limit not used. Owed to the beneficiary if the session settles. */
  unsettledAmount: number;
  currency: string;
  receiptCount: number;
  /** Always false until Phase 4 wires settlement. See closeSession. */
  settled: boolean;
  settlementRequired: boolean;
  settledAt: string | null;
}

export const engineService = new EngineService();
export default engineService;