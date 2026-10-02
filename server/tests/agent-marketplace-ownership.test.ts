import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Agent marketplace ownership.
 *
 * Every route in this router was authenticated, which is exactly why the three
 * that accepted an identity from the request body read as protected in review. A
 * logged-in user could post as another agent, bid as another agent, and — the one
 * that matters — complete any project, release its escrow, and credit an arbitrary
 * agent with totalEarned and +5 reputation.
 *
 * These assertions are behavioural rather than structural because the ownership
 * checks live in the service, not the controller. That is deliberate: an internal
 * caller invoking completeProject directly would otherwise bypass a route-level
 * check entirely.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    agentProject: { findUnique: vi.fn(), update: vi.fn() },
    agentProjectBid: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    agentEscrow: { create: vi.fn(), update: vi.fn() },
    agentProfile: { update: vi.fn() },
    agentMarketTransaction: { create: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/utils/database';
import { agentMarketplace } from '../src/services/agentMarketplace.service';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj_1',
    posterId: 'poster_a',
    status: 'ACCEPTED',
    budgetUsd: 100,
    escrow: { id: 'esc_1', releaseAmount: 98, proposedAmount: 100 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('completing a project', () => {
  it('refuses anyone who is not the poster', async () => {
    mock(prisma.agentProject.findUnique).mockResolvedValue(project() as never);

    // Completing releases escrow and credits totalEarned and reputation.
    await expect(agentMarketplace.completeProject('proj_1', 'intruder')).rejects.toThrow(/Not authorised/);
    // Nothing moved.
    expect(mock(prisma.agentEscrow.update)).not.toHaveBeenCalled();
    expect(mock(prisma.agentProfile.update)).not.toHaveBeenCalled();
  });

  it('lets the poster complete their own project', async () => {
    mock(prisma.agentProject.findUnique).mockResolvedValue(project() as never);
    mock(prisma.agentProjectBid.findFirst).mockResolvedValue({ bidderId: 'solver_b' } as never);
    mock(prisma.agentEscrow.update).mockResolvedValue({} as never);
    mock(prisma.agentProject.update).mockResolvedValue({} as never);
    mock(prisma.agentProfile.update).mockResolvedValue({} as never);
    mock(prisma.agentMarketTransaction.create).mockResolvedValue({} as never);

    await agentMarketplace.completeProject('proj_1', 'poster_a');

    // The solver credited is the winning bidder, not anyone supplied.
    const profileCalls = mock(prisma.agentProfile.update).mock.calls;
    expect(profileCalls.length).toBe(2);
    expect(profileCalls[0][0].where.id).toBe('solver_b');
    expect(profileCalls[1][0].where.id).toBe('poster_a');
  });

  it('refuses to complete twice', async () => {
    // Completing twice incremented totalEarned and reputation twice, so a retried
    // request was a payout bug rather than an idempotent no-op.
    mock(prisma.agentProject.findUnique).mockResolvedValue(project({ status: 'COMPLETED' }) as never);

    await expect(agentMarketplace.completeProject('proj_1', 'poster_a')).rejects.toThrow(/already completed/);
    expect(mock(prisma.agentEscrow.update)).not.toHaveBeenCalled();
  });

  it('refuses to release funds with no accepted bid', async () => {
    mock(prisma.agentProject.findUnique).mockResolvedValue(project() as never);
    mock(prisma.agentProjectBid.findFirst).mockResolvedValue(null as never);

    // Without a winning bid there is nobody to pay, and guessing is worse than
    // refusing.
    await expect(agentMarketplace.completeProject('proj_1', 'poster_a')).rejects.toThrow(/No accepted bid/);
    expect(mock(prisma.agentEscrow.update)).not.toHaveBeenCalled();
  });
});

describe('accepting a bid', () => {
  it('refuses anyone who is not the poster of that project', async () => {
    mock(prisma.agentProjectBid.findUnique).mockResolvedValue({
      id: 'bid_1',
      proposedAmount: 100,
      project: { id: 'proj_1', posterId: 'poster_a' },
    } as never);

    await expect(agentMarketplace.acceptBid('bid_1', 'intruder')).rejects.toThrow(/Not authorised/);
    expect(mock(prisma.agentEscrow.create)).not.toHaveBeenCalled();
  });

  it('allows an internal call that supplies no actor', async () => {
    // Some callers are not user-facing; refusing them would break legitimate
    // flows. The check is skipped when no actor is given, not when the check fails.
    mock(prisma.agentProjectBid.findUnique).mockResolvedValue({
      id: 'bid_1',
      proposedAmount: 100,
      projectId: 'proj_1',
      project: { id: 'proj_1', posterId: 'poster_a' },
    } as never);
    mock(prisma.agentEscrow.create).mockResolvedValue({ id: 'esc_1' } as never);
    mock(prisma.agentProjectBid.update).mockResolvedValue({} as never);
    mock(prisma.agentProject.update).mockResolvedValue({} as never);
    mock(prisma.agentProfile.update).mockResolvedValue({} as never);
    mock(prisma.agentMarketTransaction.create).mockResolvedValue({} as never);

    await expect(agentMarketplace.acceptBid('bid_1')).resolves.toBeDefined();
  });
});

describe('returning a project to bidding', () => {
  it('refuses anyone who is not the poster', async () => {
    // This refunds the escrow, so the party with the most reason to reach for it
    // is the bidder who lost.
    mock(prisma.agentProject.findUnique).mockResolvedValue(project() as never);

    await expect(agentMarketplace.returnToBidding('proj_1', 'no good', 'losing_bidder')).rejects.toThrow(
      /Not authorised/,
    );
    expect(mock(prisma.agentEscrow.update)).not.toHaveBeenCalled();
  });
});
