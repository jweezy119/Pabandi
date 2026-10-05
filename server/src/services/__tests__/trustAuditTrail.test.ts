import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Every score change leaves a receipt.
 *
 * ─── WHY THIS IS TESTED SEPARATELY ───────────────────────────────────────────
 *
 * A weighted ensemble is only more defensible than a model if a human can
 * reconstruct the number. That requires three things to be true at once, and
 * none of them is visible from the scoring function alone:
 *
 *   1. the write happens (the score actually moved)
 *   2. the audit row is written with the SIGNALS and WEIGHTS, not just the delta
 *   3. the row says what the previous value was
 *
 * A change that skips the audit row leaves the platform in the worst possible
 * position for a trust product: it has told a customer a number it cannot
 * explain, and has no record of how. That is precisely the failure mode the
 * whitepaper promises cannot happen, so it is asserted here rather than trusted.
 *
 * The audit destination is asserted too, because the choice is load-bearing:
 * `TrustAuditTrail` is the hashed, customer-visible chain and its `userId` is a
 * required FK, so it cannot carry CRM clients or businesses. Those go to
 * `SystemAuditLog`, the platform's existing general action log. Building a third
 * score-specific table would be a log nobody queries.
 */

/**
 * The shape of an audit row as this test asserts on it. Typed explicitly so the
 * assertions below do not need a cast — a cast here would make every `toEqual`
 * in this file unchecked, which is the opposite of what a receipt test is for.
 */
interface AuditMetadata {
  subject: string;
  previousScore: number | null;
  newScore: number;
  reason: string;
  component: string;
  methodology: string;
  signals?: {
    punctuality: number;
    paymentBehaviour: number;
    disputeRate: number;
    cancellations: number;
  };
  weights?: { w1: number; w2: number; w3: number; w4: number };
  sampleSize?: number;
}

interface AuditCall {
  data: { action: string; targetId: string | null; metadata: AuditMetadata };
}

const prismaMock = vi.hoisted(() => ({
  crmJob: { findMany: vi.fn(async (): Promise<unknown[]> => []), update: vi.fn(async () => ({})) },
  invoice: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
  dispute: { count: vi.fn(async (): Promise<number> => 0) },
  reservation: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
  business: {
    findUnique: vi.fn(async (): Promise<unknown> => null),
    update: vi.fn(async (_args: unknown) => ({})),
  },
  user: {
    findUnique: vi.fn(async (): Promise<unknown> => ({ reliabilityScore: 40 })),
    update: vi.fn(async (_args: unknown) => ({})),
  },
  crmClient: {
    findUnique: vi.fn(async (): Promise<unknown> => ({ reliabilityScore: 40, stage: null })),
    update: vi.fn(async (_args: { where: { id: string }; data: { reliabilityScore: number } }) => ({})),
  },
  crmEmployee: {
    findUnique: vi.fn(async (): Promise<unknown> => ({ reliabilityScore: 40 })),
    update: vi.fn(async (_args: unknown) => ({})),
  },
  trustPassport: { findUnique: vi.fn(async (): Promise<unknown> => null), update: vi.fn(async () => ({})) },
  systemAuditLog: { create: vi.fn(async (_args: AuditCall) => ({})) },
  trustAuditTrail: { findFirst: vi.fn(async () => null), createMany: vi.fn(async () => ({})) },
}));

const auditMock = vi.hoisted(() => ({
  enqueue: vi.fn(
    async (_entry: {
      userId: string;
      previousScore: number;
      newScore: number;
      changeReason: string;
      component: string;
      severity: string;
      metadata?: Record<string, unknown>;
    }) => {},
  ),
  flush: vi.fn(async () => {}),
}));

vi.mock('../../utils/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../trustAuditWriter', () => ({ trustAuditWriter: auditMock }));

import {
  writeReliabilityScore,
  recomputeClientScore,
  seedColdStartScore,
  recomputeBusinessScore,
} from '../trust-core.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.crmJob.findMany.mockResolvedValue([]);
  prismaMock.invoice.findMany.mockResolvedValue([]);
  prismaMock.dispute.count.mockResolvedValue(0);
  prismaMock.reservation.findMany.mockResolvedValue([]);
  prismaMock.business.findUnique.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue({ reliabilityScore: 40 });
  prismaMock.crmClient.findUnique.mockResolvedValue({ reliabilityScore: 40, stage: null });
  prismaMock.crmEmployee.findUnique.mockResolvedValue({ reliabilityScore: 40 });
});

describe('writeReliabilityScore: the audit receipt', () => {
  it('records previous score, new score, reason and component', async () => {
    await writeReliabilityScore('crmClient', 'client_1', 72, {
      reason: 'Test recompute',
      component: 'ENSEMBLE',
    });

    expect(prismaMock.systemAuditLog.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.systemAuditLog.create.mock.calls[0][0];

    expect(call.data.action).toBe('TRUST_SCORE_CHANGED');
    expect(call.data.targetId).toBe('client_1');
    expect(call.data.metadata).toMatchObject({
      subject: 'crmClient',
      previousScore: 40,
      newScore: 72,
      reason: 'Test recompute',
      component: 'ENSEMBLE',
    });
  });

  it('routes user-scoped changes to the hashed TrustAuditTrail', async () => {
    await writeReliabilityScore('user', 'user_1', 55, { reason: 'Elo update' });

    expect(auditMock.enqueue).toHaveBeenCalledTimes(1);
    const entry = auditMock.enqueue.mock.calls[0][0];

    expect(entry.userId).toBe('user_1');
    expect(entry.previousScore).toBe(40);
    expect(entry.newScore).toBe(55);
    expect(entry.changeReason).toBe('Elo update');
    // Flushed immediately. trustAuditWriter buffers and its interval is disabled,
    // so without this a dispute response could ask for history that is not there.
    expect(auditMock.flush).toHaveBeenCalled();

    // And NOT to the general log — one score change, one receipt.
    expect(prismaMock.systemAuditLog.create).not.toHaveBeenCalled();
  });

  it('captures the signals and weights that produced the score', async () => {
    // This is the assertion that makes the itemisation reconstructible rather
    // than merely present. A receipt that says "40 → 72, ENSEMBLE" is useless to
    // a customer asking why; one carrying signals and weights is not.
    prismaMock.crmJob.findMany.mockResolvedValue([
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
    ]);

    await recomputeClientScore('client_1', 'Trust event: escrow.released');

    const metadata = prismaMock.systemAuditLog.create.mock.calls[0][0].data.metadata;

    expect(metadata.signals).toEqual({
      punctuality: (2 / 3) * 100,
      paymentBehaviour: 50,
      disputeRate: 0,
      cancellations: 1,
    });
    expect(metadata.weights).toEqual({ w1: 0.4, w2: 0.3, w3: 0.2, w4: 0.1 });
    // The sample size is what lets a reader judge whether the score is
    // trustworthy: 72 from three transactions is not 72 from three hundred.
    expect(metadata.sampleSize).toBe(3);
    expect(metadata.methodology).toBe('2.0.0-ensemble');
  });

  it('records the score it persisted, after clamping', async () => {
    await writeReliabilityScore('crmClient', 'client_1', 5000, { reason: 'Buggy caller' });

    const metadata = prismaMock.systemAuditLog.create.mock.calls[0][0].data.metadata;

    // The receipt must describe what is in the database, not what the caller
    // asked for. A row saying newScore 5000 next to a stored 100 is worse than
    // no row at all.
    expect(metadata.newScore).toBe(100);
  });

  it('never lets an audit failure block the score write', async () => {
    prismaMock.systemAuditLog.create.mockRejectedValueOnce(new Error('audit table unavailable'));

    // The score is the product; the receipt is the paperwork. Losing the
    // paperwork must not also lose the score — but it is logged loudly, because
    // silently dropping receipts is how a dispute becomes unanswerable.
    await expect(
      writeReliabilityScore('crmClient', 'client_1', 60, { reason: 'Still scores' }),
    ).resolves.toBe(60);

    expect(prismaMock.crmClient.update).toHaveBeenCalledWith({
      where: { id: 'client_1' },
      data: { reliabilityScore: 60 },
    });
  });
});

describe('cold start leaves a receipt too', () => {
  it('explains why a new account scores 50', async () => {
    // "Why is my score 50?" is the first question a new customer asks, and the
    // signup flow is the least equipped to answer it without this row.
    await seedColdStartScore('user', 'user_new');

    expect(auditMock.enqueue).toHaveBeenCalledTimes(1);
    const entry = auditMock.enqueue.mock.calls[0][0];

    expect(entry.userId).toBe('user_new');
    expect(entry.newScore).toBe(50);
    expect(entry.component).toBe('COLD_START');
    expect(entry.severity).toBe('neutral');
    expect(entry.changeReason).toMatch(/no behavioural history/i);
  });

  it('is a no-op-safe fallback when the write fails', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('user vanished mid-request'));

    // Registration must not fail because the trust receipt could not be
    // written. The column default is the same 50, so the fallback is honest.
    await expect(seedColdStartScore('user', 'user_new')).resolves.toBe(50);
  });
});

describe('no history means cold start, not a zero', () => {
  it('a client with no transactions is seeded at the baseline', async () => {
    await recomputeClientScore('client_new', 'First score request');

    const metadata = prismaMock.systemAuditLog.create.mock.calls[0][0].data.metadata;

    expect(metadata.newScore).toBe(50);
    expect(metadata.reason).toMatch(/no transaction history/i);
  });

  it('a business with no reservations is seeded at the baseline', async () => {
    await recomputeBusinessScore('business_new', 'Review signals synced', 5);

    const metadata = prismaMock.systemAuditLog.create.mock.calls[0][0].data.metadata;

    expect(metadata.newScore).toBe(50);
  });

  it('a business with a 5.0 Google rating and no bookings is NOT scored 100', async () => {
    // The old reviewService wrote `5.0` here, and every 0-100 threshold read it
    // as the worst possible score. "No bookings" and "perfect rating" together
    // mean we have no evidence either way — the baseline, not either extreme.
    await recomputeBusinessScore('business_new', 'Review signals synced', 5);

    // The write itself, not just the audit row: `recomputeBusinessScore` returns
    // the baseline and writes it, so assert against what reached the database.
    expect(prismaMock.business.update).toHaveBeenCalledWith({
      where: { id: 'business_new' },
      data: { reliabilityScore: 50 },
    });
  });
});