import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * universal-escrow.service — the state machine, exercised against a fake Prisma.
 *
 * `universal-escrow-transitions.test.ts` proves the pure table. This proves the
 * service RUNS it, which is the part that was actually broken: the table existed
 * only for the six-state booking escrow, and `updateStatus` consulted nothing —
 * it validated the target string and wrote it, never reading the current state.
 *
 * So the tests below assert the two properties that a table-only test cannot see:
 *
 *   1. an illegal transition is refused BEFORE the database is written
 *   2. refusing it emits no trust event
 *
 * (2) is the one that matters. `updateStatus` emits `escrow.released` on a
 * release, and trust-core turns that into `score.changed` — a positive reputation
 * signal. An implementation that refused the write but still emitted the event
 * would have fixed the bookkeeping and left the reputation-farming primitive fully
 * intact, which is the more valuable half of the bug.
 */

const emit = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/utils/database', () => ({
  prisma: {
    universalEscrow: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/trust/trust-core', () => ({
  trustCore: { emit: (...args: any[]) => emit(...args) },
}));

const { prisma } = await import('../src/utils/database');
const escrowFind = vi.mocked(prisma.universalEscrow.findUnique);
const escrowUpdate = vi.mocked(prisma.universalEscrow.update);
const { universalEscrowService } = await import('../src/services/universal-escrow.service');

const REF = 'invoice:inv_1';

function escrowAt(status: string) {
  return {
    id: 'esc_1',
    referenceId: REF,
    status,
    amount: 500,
    currency: 'USDC',
    parties: [
      { partyId: 'user_seller', role: 'seller' },
      { partyId: 'user_buyer', role: 'buyer' },
    ],
    conditions: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  emit.mockResolvedValue(undefined);
});

describe('universalEscrowService.updateStatus', () => {
  it('refuses draft -> released and writes nothing', async () => {
    escrowFind.mockResolvedValueOnce({ status: 'draft' });

    await expect(universalEscrowService.updateStatus(REF, 'released')).rejects.toThrow(/cannot move escrow from draft to released/i);

    expect(prisma.universalEscrow.update).not.toHaveBeenCalled();
  });

  it('emits no trust event when a release is refused', async () => {
    // The load-bearing assertion. escrow.released -> score.changed is a positive
    // reputation signal, so emitting it on a refused write would leave the
    // reputation-farming path open even with the state machine in place.
    //
    // `update` is mocked to return a well-formed escrow on purpose. Without that,
    // an unfixed service reaches `escrow.parties`, throws on undefined, and this
    // test passes for the wrong reason — it would have "caught" the bug by
    // crashing rather than by refusing.
    escrowFind.mockResolvedValueOnce({ status: 'draft' });
    escrowUpdate.mockResolvedValue(escrowAt('released'));

    await expect(universalEscrowService.updateStatus(REF, 'released')).rejects.toThrow();

    // If the write were allowed, this is exactly what would be emitted.
    expect(prisma.universalEscrow.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith('escrow.released', expect.anything());
  });

  it('refuses released money that was already refunded', async () => {
    escrowFind.mockResolvedValueOnce({ status: 'refunded' });

    await expect(universalEscrowService.updateStatus(REF, 'released')).rejects.toThrow(/terminal/i);
    expect(prisma.universalEscrow.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('reads the current state before deciding', async () => {
    // Guards the regression that made this bug possible: an update that never
    // reads cannot validate a transition.
    escrowFind.mockResolvedValueOnce({ status: 'draft' });

    await expect(universalEscrowService.updateStatus(REF, 'released')).rejects.toThrow();

    expect(prisma.universalEscrow.findUnique).toHaveBeenCalledWith({
      where: { referenceId: REF },
      select: { status: true },
    });
  });

  it('reports a missing escrow as 404 rather than writing', async () => {
    escrowFind.mockResolvedValueOnce(null);

    await expect(universalEscrowService.updateStatus(REF, 'funded')).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.universalEscrow.update).not.toHaveBeenCalled();
  });

  it('allows funded -> conditions_met -> released and emits once on release', async () => {
    escrowFind
      .mockResolvedValueOnce({ status: 'funded' })
      .mockResolvedValueOnce({ status: 'conditions_met' });
    escrowUpdate
      .mockResolvedValueOnce(escrowAt('conditions_met'))
      .mockResolvedValueOnce(escrowAt('released'));

    await universalEscrowService.updateStatus(REF, 'conditions_met');
    await universalEscrowService.updateStatus(REF, 'released');

    expect(prisma.universalEscrow.update).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'escrow.released',
      expect.objectContaining({ escrowId: 'esc_1', amount: 500, passportId: 'user_seller' }),
    );
  });

  it('treats a repeated status as an idempotent no-op', async () => {
    // failure-ownership.service.ts moves an escrow to `disputed` without first
    // checking whether it is already disputed, and one of its two call sites has
    // no try/catch. Without this, re-disputing would throw during dispute
    // creation.
    escrowFind
      .mockResolvedValueOnce({ status: 'disputed' })
      .mockResolvedValueOnce(escrowAt('disputed'));

    const result = await universalEscrowService.updateStatus(REF, 'disputed');

    expect(prisma.universalEscrow.update).not.toHaveBeenCalled();
    // Critically: no second escrow.disputed event, which would double-count the
    // negative signal against the counterparty.
    expect(emit).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'disputed' });
  });

  it('still rejects a status string that is not one of the seven', async () => {
    await expect(universalEscrowService.updateStatus(REF, 'settled')).rejects.toThrow(/invalid status/i);
  });
});