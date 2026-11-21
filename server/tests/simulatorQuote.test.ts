import { describe, expect, it } from 'vitest';
import { computeEstimate } from '../src/services/simulator/swarm.service';

/**
 * The public quote is the one piece of the simulator that is pure — it needs no
 * database and no persisted simulation. That is the half the landing page and the
 * invoice share links actually use, so it is the half worth pinning down.
 *
 * The routes this service backs were deleted, then restored; these assertions are
 * here so a third pass over the file has something to break against.
 */

const FACTORS = { scale: 3, timelineUrgency: 3, quality: 'Standard' };

describe('computeEstimate', () => {
  it('returns the four sections the proposal renders', async () => {
    const result = await computeEstimate(FACTORS);
    expect(result).toHaveProperty('materials');
    expect(result).toHaveProperty('staffing');
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('estimate');
  });

  it('is deterministic for the same factors', async () => {
    const a = await computeEstimate(FACTORS);
    const b = await computeEstimate(FACTORS);
    expect(a.estimate).toEqual(b.estimate);
  });

  it('costs more at a larger scale than a smaller one', async () => {
    const small = await computeEstimate({ ...FACTORS, scale: 1 });
    const large = await computeEstimate({ ...FACTORS, scale: 5 });
    expect(large.estimate.totalCost).toBeGreaterThan(small.estimate.totalCost);
  });

  it('accepts string scale names as well as 1–5 sliders', async () => {
    const named = await computeEstimate({ ...FACTORS, scale: 'small' });
    const numeric = await computeEstimate({ ...FACTORS, scale: 1 });
    expect(named.estimate.totalCost).toBeCloseTo(numeric.estimate.totalCost, 5);
  });

  it('does not require a database — the public quote must work statelessly', async () => {
    // No DATABASE_URL is set in this environment. If this call touched Prisma it
    // would throw here rather than return, which is the point of the assertion.
    const result = await computeEstimate({ projectType: 'app-development' });
    expect(result.estimate.totalCost).toBeGreaterThan(0);
  });
});
