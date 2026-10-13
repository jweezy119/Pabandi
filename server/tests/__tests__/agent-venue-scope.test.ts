import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * One venue's agent run, repricing the whole platform.
 *
 * `executeBottlePriceIncrease` was `where: { isActive: true }` — no venue predicate
 * at all. Running the revenue agent against a single venue multiplied the base price
 * of every active bottle package belonging to every venue. `runAllVenues` loops the
 * same call over every venue, so one pass compounded the multiplier once per venue
 * across the entire catalogue, silently, on live pricing.
 *
 * The other two executors were scoped but took the venue from the agent's own
 * payload, which is produced by `reason()` — the component deciding whom to charge.
 * The list of who to charge and the list of whose venue it is should not be able to
 * disagree, so all three now read the venue from the request context.
 *
 * The missing-venue case is the one worth pinning: "multiply nothing" is a no-op,
 * "multiply everything because the context was incomplete" is the bug.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    bottlePackage: { updateMany: vi.fn() },
    coverCharge: { updateMany: vi.fn() },
    guestList: { updateMany: vi.fn() },
    agentExecution: { create: vi.fn() },
    agentOrchestration: { create: vi.fn() },
  },
}));

import { revenueMaxService, venueBrainService, promoterAutonService } from '../../src/services/agentic.service';
import { prisma } from '../../src/utils/database';

const VENUE = 'venue_1';

function bottleWhere() {
  return (prisma.bottlePackage.updateMany as any).mock.calls[0][0].where;
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.bottlePackage.updateMany as any).mockResolvedValue({ count: 3 });
  (prisma.coverCharge.updateMany as any).mockResolvedValue({ count: 1 });
  (prisma.guestList.updateMany as any).mockResolvedValue({ count: 2 });
});

describe('agent executors are scoped to one venue', () => {
  it('reprices only the venue the run was invoked for', async () => {
    await revenueMaxService.executeBottlePriceIncrease({ multiplier: 1.1 }, { venueId: VENUE } as any);
    expect(bottleWhere()).toEqual({ isActive: true, venueId: VENUE });
  });

  it('refuses to reprice anything without a venue', async () => {
    const result = await revenueMaxService.executeBottlePriceIncrease({ multiplier: 2 }, {} as any);
    // The failure direction that matters: an incomplete context must not widen the
    // blast radius from one venue to the whole catalogue.
    expect(prisma.bottlePackage.updateMany).not.toHaveBeenCalled();
    expect(result.updatedCount).toBe(0);
    expect(result.skipped).toBeTruthy();
  });

  it('prefers the context venue over the one in the payload', async () => {
    // reason() picks the payload; the request names the venue being operated on.
    // If these could disagree, the payload wins by accident rather than by decision.
    await venueBrainService.executeCoverChargeChange(
      { venueId: 'venue_from_payload', newPrice: 20 },
      { venueId: VENUE } as any,
    );
    expect((prisma.coverCharge.updateMany as any).mock.calls[0][0].where.venueId).toBe(VENUE);
  });

  it('scopes deposit adjustments to the venue as well as the guests', async () => {
    await promoterAutonService.executeDepositAdjustment(
      { targetGuests: ['u1', 'u2'], newDepositMultiplier: 2 },
      { venueId: VENUE } as any,
    );
    const where = (prisma.guestList.updateMany as any).mock.calls[0][0].where;
    expect(where.venueId).toBe(VENUE);
    expect(where.userId).toEqual({ in: ['u1', 'u2'] });
  });

  it('takes the venue from the payload when the context has none', async () => {
    // Convenience preserved, but it is the fallback and not the primary path.
    await venueBrainService.executeCoverChargeChange(
      { venueId: VENUE, newPrice: 15 },
      {} as any,
    );
    expect((prisma.coverCharge.updateMany as any).mock.calls[0][0].where.venueId).toBe(VENUE);
  });
});