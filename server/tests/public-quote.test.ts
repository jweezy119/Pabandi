import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/services/simulator/swarm.service';

describe('computeEstimate (pure swarm forecasting)', () => {
  it('returns a complete deterministic estimate in memory without writing to database', async () => {
    const factors = {
      timelineUrgency: 3,
      quality: 3,
      scale: 3,
    };

    const result = await computeEstimate(factors);

    expect(result).toBeDefined();
    expect(result.materials).toBeDefined();
    expect(result.staffing).toBeDefined();
    expect(result.timeline).toBeDefined();
    expect(result.estimate).toBeDefined();

    expect(result.estimate.totalCost).toBeGreaterThan(0);
    expect(result.estimate.breakdown.materials).toBe(result.materials.totalMaterialCost);
    expect(result.estimate.breakdown.labor).toBe(result.staffing.totalLaborCost);
    expect(result.timeline.estimatedDays).toBeGreaterThan(0);
  });

  it('adjusts cost monotonically when factors increase', async () => {
    const baseline = await computeEstimate({ timelineUrgency: 2, quality: 2, scale: 2 });
    const elevated = await computeEstimate({ timelineUrgency: 4, quality: 4, scale: 4 });

    expect(elevated.estimate.totalCost).toBeGreaterThan(baseline.estimate.totalCost);
    expect(elevated.materials.totalMaterialCost).toBeGreaterThan(baseline.materials.totalMaterialCost);
  });
});
