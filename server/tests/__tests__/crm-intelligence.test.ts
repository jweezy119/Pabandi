import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The model that was written but never switched on.
 *
 * `customerIntelligence.service` computes CLV, churn probability, segmentation and a
 * next-best-action. It had no caller anywhere in the product, and its features came
 * from nightlife `Reservation` rows — a table with nothing to do with a CrmClient.
 * Pointed at a client it would have seen an empty history and still produced a
 * confident segment and a recommended action from nothing.
 *
 * Two things are pinned here.
 *
 * The gate. Below three completed jobs the service returns an explicit reason and no
 * verdict. Its own `calculateConfidence` starts at 50 and floors at 40, so confidence
 * was never a usable gate: a client with no history reports 50-75% confidence in
 * predictions about themselves.
 *
 * The segment fallback, fixed in the model. `segmentCustomer` ended in an
 * unconditional `return 'LOST'`, so every client who was not large enough, loyal
 * enough or stale enough fell through to LOST — including every brand-new lead, since
 * no revenue meant no threshold matched and daysSinceLastOrder of 0 ruled out AT_RISK.
 * Every new lead was labelled LOST.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmJob: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../src/utils/database';
import { getClientIntelligence } from '../../src/services/crm-intelligence.service';
import { customerIntelligenceService } from '../../src/services/ai/customerIntelligence.service';

const CLIENT = 'client_1';
const SVC = 'svc_1';

function job(status: string, completedAt: Date | null = null) {
  return { clientId: CLIENT, status, completedAt, price: 100 };
}
function invoice(subtotal: number) {
  return { subtotal, paidAt: new Date() };
}

/** Assert the model was never asked for a verdict. */
function expectNoVerdict(result: Awaited<ReturnType<typeof getClientIntelligence>>) {
  expect(result.hasVerdict).toBe(false);
  expect(result.segment).toBeUndefined();
  expect(result.nextBestAction).toBeUndefined();
  expect(result.churnProbability).toBeUndefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  // restoreAllMocks, not just clearAllMocks: the model-failure test replaces
  // predictCLV with a rejecting spy, and a clear does not put the real one back — so
  // it would silently reject for every test after it.
  vi.restoreAllMocks();
  (prisma.invoice.findMany as any).mockResolvedValue([]);
});

describe('the evidence gate', () => {
  it('says nothing about a client with no history, and explains why', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([]);
    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');

    expectNoVerdict(result);
    expect(result.reason).toMatch(/no completed jobs/i);
    // The facts are still real and still shown — the panel is useful even with no verdict.
    expect(result.facts.completedJobs).toBe(0);
    expect(result.facts.lastJobAt).toBeNull();
  });

  it('says nothing after a single job', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([job('COMPLETED', new Date())]);
    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');

    expectNoVerdict(result);
    expect(result.reason).toMatch(/only 1 completed job/i);
    expect(result.facts.completedJobs).toBe(1);
  });

  it('refuses a verdict when jobs completed but nothing was ever paid', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
    ]);
    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');

    // Three free jobs are not a revenue relationship. Without this, CLV is projected
    // forward from a total of zero and presented as a number.
    expectNoVerdict(result);
    expect(result.reason).toMatch(/no paid invoices/i);
  });

  it('gives a verdict once there is enough history, and the numbers come from the rows', async () => {
    const dates = [
      new Date('2026-01-01'),
      new Date('2026-02-01'),
      new Date('2026-03-01'),
      new Date('2026-04-01'),
    ];
    (prisma.crmJob.findMany as any).mockResolvedValue(
      dates.map((d) => job('COMPLETED', d)),
    );
    (prisma.invoice.findMany as any).mockResolvedValue([invoice(100), invoice(250)]);

    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');

    expect(result.hasVerdict).toBe(true);
    expect(result.facts.completedJobs).toBe(4);
    expect(result.facts.paidInvoices).toBe(2);
    expect(result.facts.totalSpent).toBe(350);
    expect(result.nextBestAction).toBeTruthy();
  });

  it('counts only completed jobs and paid invoices, not cancelled ones', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
      job('CANCELLED'),
    ]);
    (prisma.invoice.findMany as any).mockResolvedValue([invoice(80), invoice(80)]);

    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');
    expect(result.facts.completedJobs).toBe(3);
    expect(result.facts.cancelledJobs).toBe(1);
  });

  it('reports a model failure as no verdict rather than as a result', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
      job('COMPLETED', new Date()),
    ]);
    (prisma.invoice.findMany as any).mockResolvedValue([invoice(500)]);

    vi.spyOn(customerIntelligenceService, 'predictCLV').mockRejectedValue(new Error('boom'));
    const result = await getClientIntelligence(CLIENT, SVC, 'biz_1');

    // The model catches its own errors and returns a fallback with confidence 40.
    // Presenting that as a verdict would be a prediction dressed as a result.
    expectNoVerdict(result);
  });
});

describe('segment fallback, fixed in the model', () => {
  const features = (over: Partial<any> = {}) => ({
    customerId: 'c',
    businessId: 'b',
    firstOrderDate: new Date(),
    lastOrderDate: new Date(),
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    orderFrequency: 0,
    daysSinceLastOrder: 0,
    cancellationRate: 0,
    noShowRate: 0,
    ...over,
  });

  it('never calls a brand-new lead LOST', async () => {
    const clv = await customerIntelligenceService.predictCLV(features());
    expect(clv.segment).not.toBe('LOST');
  });

  it('calls someone who bought last week a potential customer, not a lost one', async () => {
    const clv = await customerIntelligenceService.predictCLV(
      features({ totalOrders: 2, totalRevenue: 90, daysSinceLastOrder: 7 }),
    );
    expect(clv.segment).not.toBe('LOST');
  });

  it('still calls someone genuinely dormant LOST', async () => {
    // A year of silence, and they were a good customer while they were here. This is
    // the case LOST is for — the ordering matters, because the 90-day AT_RISK check
    // would otherwise swallow it and leave LOST unreachable.
    const clv = await customerIntelligenceService.predictCLV(
      features({ totalOrders: 12, totalRevenue: 4000, daysSinceLastOrder: 400 }),
    );
    expect(clv.segment).toBe('LOST');
  });

  it('calls three months of silence AT_RISK rather than LOST', async () => {
    const clv = await customerIntelligenceService.predictCLV(
      features({ totalOrders: 12, totalRevenue: 4000, daysSinceLastOrder: 120 }),
    );
    // Still reachable, still actionable, and not yet lost — the distinction is the
    // point of having both labels.
    expect(clv.segment).toBe('AT_RISK');
  });
});