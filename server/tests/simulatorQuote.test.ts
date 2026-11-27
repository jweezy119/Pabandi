import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
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

describe('POST /api/v1/simulator/public/quote route', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const mod = await import('../src/routes/simulator.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/simulator', mod.default);
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1/simulator/public/quote`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('accepts flat landing-page payloads ({ scale, timelineUrgency, quality })', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scale: 3, timelineUrgency: 3, quality: 'Senior' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.quote.totalUsd).toBeGreaterThan(0);
    expect(body.data.estimate.totalCost).toBeGreaterThan(0);
  });

  it('accepts canonical nested payloads ({ projectType, factors })', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectType: 'mvp',
        factors: { scale: 4, timelineUrgency: 2, quality: 'Lead' },
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.projectType).toBe('mvp');
    expect(body.quote.depositRequiredUsd).toBeGreaterThan(0);
  });
});
