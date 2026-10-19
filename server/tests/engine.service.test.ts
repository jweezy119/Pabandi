import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/utils/database';
import engineService, { tierForScore, hashPayload, SESSION_TIERS } from '../src/services/engine.service';

/**
 * These run against the local database, creating real rows. The engine's
 * correctness claims are about what happens under concurrency and about cents
 * arithmetic, and neither is observable through a mock: a mocked conditional
 * UPDATE is an assertion that the mock was written the way the real query was.
 */

const OWNER = 'engine-test-owner';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.pabandiSession.deleteMany({ where: { ownerId: OWNER } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.pabandiSession.deleteMany({ where: { ownerId: OWNER } });
});

async function open(score: number) {
  return engineService.openSession('agent', OWNER, score);
}

describe('tierForScore', () => {
  it('gives 800+ the large 30-day tab', () => {
    const tier = tierForScore(800);
    expect(tier.totalLimit).toBe(1000);
    expect(tier.ttlHours).toBe(24 * 30);
  });

  it('gives 500-799 the 7-day tab', () => {
    const tier = tierForScore(500);
    expect(tier.totalLimit).toBe(100);
    expect(tier.ttlHours).toBe(24 * 7);

    expect(tierForScore(799).totalLimit).toBe(100);
  });

  it('gives below 500 the 20 / 24h tab', () => {
    const tier = tierForScore(499);
    expect(tier.totalLimit).toBe(20);
    expect(tier.ttlHours).toBe(24);
  });

  it('gives a score of 0 the lowest tier rather than throwing', () => {
    expect(tierForScore(0).totalLimit).toBe(20);
  });

  it('has no gaps between tiers', () => {
    // Walk every integer boundary and assert a tier was found. A future edit
    // that removes a tier should fail here rather than silently returning the
    // last one for scores it was never meant to cover.
    for (const tier of SESSION_TIERS) {
      expect(tierForScore(tier.minScore)).toBe(tier);
    }
    expect(tierForScore(SESSION_TIERS[0]!.minScore - 1)).toBe(SESSION_TIERS[1]!);
  });
});

describe('hashPayload', () => {
  it('is stable across key order', () => {
    expect(hashPayload({ a: 1, b: { c: 2, d: 3 } })).toBe(hashPayload({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('changes when a value changes', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('does not collide on stringified vs numeric amounts', () => {
    expect(hashPayload({ amount: 5 })).not.toBe(hashPayload({ amount: '5' }));
  });

  it('handles arrays whose order genuinely matters', () => {
    expect(hashPayload({ xs: [1, 2] })).not.toBe(hashPayload({ xs: [2, 1] }));
  });
});

describe('openSession', () => {
  it('creates an active session with the tier limit and full remaining balance', async () => {
    const session = await open(850);

    expect(session.totalLimit).toBe(1000);
    expect(session.spent).toBe(0);
    expect(session.remaining).toBe(1000);
    expect(session.status).toBe('active');
    expect(session.ephemeralKey.length).toBeGreaterThan(20);
  });

  it('sets expiresAt from the tier ttl', async () => {
    const session = await open(0);
    const ttlMs = Date.parse(session.expiresAt) - Date.now();

    // Within a minute of exactly 24h, allowing for test execution time.
    expect(ttlMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 60_000);
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('issues a distinct ephemeral key per session', async () => {
    const a = await open(850);
    const b = await open(850);

    expect(a.ephemeralKey).not.toBe(b.ephemeralKey);
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});

describe('executeTransaction', () => {
  it('spends, writes a receipt and returns actionRequired none', async () => {
    const { sessionId } = await open(850);

    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'booking',
      amount: 120,
      payload: { serviceId: 'abc' },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.value.receipt.amount).toBe(120);
    expect(outcome.value.receipt.actionType).toBe('booking');
    expect(outcome.value.receipt.signature).toHaveLength(64);
    expect(outcome.value.session.spent).toBe(120);
    expect(outcome.value.session.remaining).toBe(880);
    expect(outcome.value.actionRequired).toBe('none');
    expect(outcome.value.idempotentReplay).toBe(false);
  });

  it('accumulates across several actions', async () => {
    const { sessionId } = await open(850);

    for (const amount of [100, 200, 300]) {
      const outcome = await engineService.executeTransaction({
        sessionId,
        actionType: 'booking',
        amount,
        payload: {},
      });
      expect(outcome.ok).toBe(true);
    }

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.spent).toBe(600);
  });

  it('rejects an action beyond the remaining limit and does not overspend', async () => {
    const { sessionId } = await open(0); // $20 limit

    const tooMuch = await engineService.executeTransaction({
      sessionId,
      actionType: 'escrow',
      amount: 25,
      payload: {},
    });

    expect(tooMuch.ok).toBe(false);
    if (tooMuch.ok) return;
    expect(tooMuch.error.code).toBe('LIMIT_EXCEEDED');

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.spent).toBe(0);
  });

  it('allows spending the limit to exactly zero and marks the session exhausted', async () => {
    const { sessionId } = await open(0); // $20

    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'escrow',
      amount: 20,
      payload: {},
    });

    expect(outcome.ok).toBe(true);

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.spent).toBe(20);
    expect(session.status).toBe('exhausted');

    // And a further action is refused.
    const second = await engineService.executeTransaction({
      sessionId,
      actionType: 'escrow',
      amount: 0.01,
      payload: {},
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(['LIMIT_EXCEEDED', 'SESSION_NOT_ACTIVE']).toContain(second.error.code);
  });

  it('does not lose a cent to float arithmetic', async () => {
    const { sessionId } = await open(0); // $20

    // 0.1 + 0.2 !== 0.3 in binary floating point. Spending the three values in
    // sequence must not leave 19.999999999999996 spent.
    for (const amount of [0.1, 0.2, 19.7]) {
      const outcome = await engineService.executeTransaction({
        sessionId,
        actionType: 'booking',
        amount,
        payload: {},
      });
      expect(outcome.ok).toBe(true);
    }

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.spent).toBe(20);
  });

  it('refuses to overspend under concurrent actions', async () => {
    // This is the case the conditional UPDATE exists for. Ten simultaneous
    // $3 spends against a $20 tab: at most six can succeed. Read-then-write
    // would let all ten pass a check each saw as true and drive spent to $30.
    const { sessionId } = await open(0);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        engineService.executeTransaction({
          sessionId,
          actionType: 'booking',
          amount: 3,
          payload: { concurrent: true },
        })
      )
    );

    const succeeded = attempts.filter((a) => a.ok);
    expect(succeeded.length).toBeLessThanOrEqual(6);
    expect(succeeded.length).toBeGreaterThan(0);

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.spent).toBeLessThanOrEqual(20);

    // Every success has a receipt, and the receipts sum to what was debited.
    const receipts = await engineService.listReceipts(sessionId);
    const receiptTotal = receipts.reduce((sum, r) => sum + r.amount, 0);
    expect(receiptTotal).toBeCloseTo(session.spent, 6);
    expect(receipts).toHaveLength(succeeded.length);
  });

  it('returns the original receipt for a retried idempotency key', async () => {
    const { sessionId } = await open(850);

    const first = await engineService.executeTransaction({
      sessionId,
      actionType: 'invoice_pay',
      amount: 50,
      payload: { invoiceId: 'inv_1' },
      idempotencyKey: 'retry-me',
    });

    const second = await engineService.executeTransaction({
      sessionId,
      actionType: 'invoice_pay',
      amount: 50,
      payload: { invoiceId: 'inv_1' },
      idempotencyKey: 'retry-me',
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.value.idempotentReplay).toBe(true);
    expect(second.value.receipt.id).toBe(first.value.receipt.id);

    // The balance moved once, not twice.
    expect(second.value.session.spent).toBe(50);
    const receipts = await engineService.listReceipts(sessionId);
    expect(receipts).toHaveLength(1);
  });

  it('rejects a non-positive amount', async () => {
    const { sessionId } = await open(850);

    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'booking',
      amount: 0,
      payload: {},
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('INVALID_AMOUNT');
  });

  it('reports an unknown session as not found', async () => {
    const outcome = await engineService.executeTransaction({
      sessionId: 'does-not-exist',
      actionType: 'booking',
      amount: 1,
      payload: {},
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('refuses an expired session and marks it closed', async () => {
    const { sessionId } = await open(850);

    await prisma.pabandiSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'booking',
      amount: 1,
      payload: {},
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('SESSION_EXPIRED');

    const session = await prisma.pabandiSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe('closed');
  });

  it('refuses a closed session', async () => {
    const { sessionId } = await open(850);
    await engineService.closeSession(sessionId);

    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'booking',
      amount: 1,
      payload: {},
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('SESSION_NOT_ACTIVE');
  });
});

describe('closeSession', () => {
  it('closes and reports the unsettled remainder without claiming a settlement', async () => {
    const { sessionId } = await open(850);

    await engineService.executeTransaction({ sessionId, actionType: 'booking', amount: 250, payload: {} });

    const outcome = await engineService.closeSession(sessionId);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.value.status).toBe('closed');
    expect(outcome.value.spent).toBe(250);
    expect(outcome.value.unsettledAmount).toBe(750);
    expect(outcome.value.receiptCount).toBe(1);
    // Phase 4 owns settlement. Until it exists, close must not imply a
    // transfer happened.
    expect(outcome.value.settled).toBe(false);
    expect(outcome.value.settledAt).toBeNull();
  });

  it('is idempotent when closed twice', async () => {
    const { sessionId } = await open(850);

    const first = await engineService.closeSession(sessionId);
    const second = await engineService.closeSession(sessionId);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.status).toBe('closed');
  });

  it('reports an unknown session as not found', async () => {
    const outcome = await engineService.closeSession('nope');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('SESSION_NOT_FOUND');
  });
});

describe('findSettleableSessions', () => {
  it('returns only expired, unsettled, active sessions', async () => {
    const expired = await open(0);
    await prisma.pabandiSession.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    // Still live -- must not appear.
    const live = await open(0);

    const due = await engineService.findSettleableSessions();
    const ids = due.map((s) => s.id);

    expect(ids).toContain(expired.sessionId);
    expect(ids).not.toContain(live.sessionId);
  });
});