import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Delivery outcomes must move the worker's deliveryScore.
 *
 * `jobLifecycle.service` and `crm.service` emit `delivery.on_time`,
 * `delivery.late` and `delivery.missed`. Before this, NOTHING subscribed to those
 * three — the only subscribers were score.changed, escrow.*, checkin.verified and
 * passport.linked. So:
 *
 *   - a provider who completed every job on time: deliveryScore never moved
 *   - a provider who no-showed repeatedly: deliveryScore never moved either
 *
 * Delivery is the signal the reputation product is built on, and it was inert.
 * Nothing failed, nothing logged an error, and no test noticed.
 */

const subscribers = new Map<string, Array<(e: any) => Promise<void> | void>>();
const durable = new Set<string>();

vi.mock('../src/services/event-bus.service', () => ({
  eventBus: {
    subscribe: vi.fn((type: string, handler: (e: any) => any) => {
      if (!subscribers.has(type)) subscribers.set(type, []);
      subscribers.get(type)!.push(handler);
    }),
    markDurable: vi.fn((type: string) => { durable.add(type); }),
    markStarted: vi.fn(),
    emitEvent: vi.fn(),
    publish: vi.fn(async () => {}),
  },
}));

const job: any = { passportId: null, employee: null };
const passport: any = { deliveryScore: 500 };
const updates: any[] = [];

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmJob: { findFirst: vi.fn(async () => job), update: vi.fn() },
    trustPassport: {
      findUnique: vi.fn(async () => passport),
      update: vi.fn(async (args: any) => { updates.push(args); return {}; }),
    },
    invoice: { findFirst: vi.fn(async () => null) },
    invoiceTrustEvent: { create: vi.fn(async () => ({})) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { initializeTrustCore } from '../src/services/trust-core.service';

async function fire(type: string, payload: Record<string, unknown> = {}) {
  for (const h of subscribers.get(type) ?? []) await h({ jobId: 'job_1', data: {}, ...payload });
}

beforeEach(() => {
  subscribers.clear();
  durable.clear();
  updates.length = 0;
  job.passportId = null;
  job.employee = null;
  passport.deliveryScore = 500;
  initializeTrustCore();
});

describe('delivery events are wired up at all', () => {
  it('subscribes to all three', () => {
    for (const type of ['delivery.on_time', 'delivery.late', 'delivery.missed']) {
      expect(subscribers.has(type), `${type} has no subscriber`).toBe(true);
    }
  });

  it('marks them durable, so a lost event is replayed rather than dropped', () => {
    // Same reasoning as escrow.*: an event that moved a score and was lost in a
    // process restart is a worker who turned up and got nothing.
    for (const type of ['delivery.on_time', 'delivery.late', 'delivery.missed']) {
      expect(durable.has(type), `${type} is not durable`).toBe(true);
    }
  });
});

describe('score movement', () => {
  it('on time: +10', async () => {
    job.passportId = 'pp_1';
    await fire('delivery.on_time');
    expect(updates).toHaveLength(1);
    expect(updates[0].where.id).toBe('pp_1');
    expect(updates[0].data.deliveryScore).toBe(510);
  });

  it('late: -5', async () => {
    job.passportId = 'pp_1';
    await fire('delivery.late');
    expect(updates[0].data.deliveryScore).toBe(495);
  });

  it('missed: -20', async () => {
    job.passportId = 'pp_1';
    await fire('delivery.missed');
    expect(updates[0].data.deliveryScore).toBe(480);
  });

  it('resolves the worker through the assigned employee when the job has no passport', async () => {
    // Staff workers are scored through CrmEmployee.passportId. Reading only the
    // job would silently exclude every employee, which is most providers.
    job.employee = { passportId: 'pp_emp' };
    await fire('delivery.on_time');
    expect(updates[0].where.id).toBe('pp_emp');
  });

  it('prefers the job passport over the employee one', async () => {
    job.passportId = 'pp_job';
    job.employee = { passportId: 'pp_emp' };
    await fire('delivery.on_time');
    expect(updates[0].where.id).toBe('pp_job');
  });
});

describe('clamping and attribution', () => {
  it('never exceeds 1000', async () => {
    passport.deliveryScore = 995;
    job.passportId = 'pp_1';
    await fire('delivery.on_time');
    expect(updates[0].data.deliveryScore).toBe(1000);
  });

  it('never drops below 0', async () => {
    passport.deliveryScore = 3;
    job.passportId = 'pp_1';
    await fire('delivery.missed');
    expect(updates[0].data.deliveryScore).toBe(0);
  });

  it('scores nobody when there is no worker passport', async () => {
    // Attributing a penalty to an arbitrary worker would be worse than not
    // scoring. This must be a no-op, not a guess.
    job.passportId = null;
    job.employee = null;
    await fire('delivery.missed');
    expect(updates).toHaveLength(0);
  });

  it('is idempotent in the sense that it moves by exactly one step per event', async () => {
    // Not idempotent by design — each delivery is a real occurrence. The property
    // that matters is that it does not compound beyond the recorded delta.
    job.passportId = 'pp_1';
    await fire('delivery.on_time');
    expect(updates).toHaveLength(1);
    expect(updates[0].data.deliveryScore - 500).toBe(10);
  });

  it('does nothing when the job does not exist', async () => {
    const { prisma } = await import('../src/utils/database');
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValueOnce(null as never);
    await fire('delivery.on_time');
    expect(updates).toHaveLength(0);
  });
});