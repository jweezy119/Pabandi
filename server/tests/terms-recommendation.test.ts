import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildTermsRecommendation, recordTermsDecision } from '../src/services/terms-recommendation.service';
import { recommendTerms, normalisePaymentScore } from '../src/services/rail-router.service';
import { prisma } from '../src/utils/database';

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmClient: { findUnique: vi.fn() },
    businessPaymentMethod: { findMany: vi.fn() },
    business: { findUnique: vi.fn() },
    systemAuditLog: { create: vi.fn() },
    crmActivity: { create: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe('recommendTerms', () => {
  it('offers net-30 at 70 and above', () => {
    expect(recommendTerms(70).tier).toBe('net_30');
    expect(recommendTerms(100).tier).toBe('net_30');
    expect(recommendTerms(70).dueInDays).toBe(30);
    expect(recommendTerms(70).requireEscrow).toBe(false);
  });

  it('requires immediate payment from 40 to 69', () => {
    expect(recommendTerms(40).tier).toBe('immediate');
    expect(recommendTerms(69).tier).toBe('immediate');
    expect(recommendTerms(40).requireEscrow).toBe(false);
  });

  it('requires a deposit and escrow below 40', () => {
    expect(recommendTerms(39).tier).toBe('deposit_escrow');
    expect(recommendTerms(0).requireEscrow).toBe(true);
  });

  it('names the score in the reason so the UI can explain itself', () => {
    expect(recommendTerms(82).reason).toContain('82');
  });
});

describe('normalisePaymentScore', () => {
  it('converts the stored 0-1000 scale to 0-100', () => {
    expect(normalisePaymentScore(820)).toBe(82);
    expect(normalisePaymentScore(400)).toBe(40);
  });

  it('defaults to 50 when there is no score', () => {
    expect(normalisePaymentScore(null)).toBe(50);
    expect(normalisePaymentScore(undefined)).toBe(50);
  });

  it('clamps out-of-range values', () => {
    expect(normalisePaymentScore(5000)).toBe(100);
    expect(normalisePaymentScore(-10)).toBe(0);
  });
});

describe('buildTermsRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.businessPaymentMethod.findMany).mockResolvedValue([]);
    mock(prisma.business.findUnique).mockResolvedValue({ address: 'Austin, TX, United States', currency: 'USD' });
  });

  it('returns null for an unknown client', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue(null);
    await expect(buildTermsRecommendation('biz_1', 'nope')).resolves.toBeNull();
  });

  it('maps a high payment score to net-30 and a due date 30 days out', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue({
      id: 'cli_1',
      name: 'Acme',
      address: 'Austin, TX, United States',
      passport: { paymentScore: 820, paymentSampleSize: 12 },
    });

    const view = await buildTermsRecommendation('biz_1', 'cli_1', { amount: 150 });

    expect(view?.recommendation.tier).toBe('net_30');
    const due = new Date(view!.suggestedDueDate);
    const delta = due.getTime() - Date.now();
    expect(Math.round(delta / (24 * 60 * 60 * 1000))).toBe(30);
  });

  it('flags a client with no payment history as defaulted', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue({
      id: 'cli_1',
      name: 'New Client',
      address: null,
      passport: { paymentScore: 500, paymentSampleSize: 0 },
    });

    const view = await buildTermsRecommendation('biz_1', 'cli_1');

    // 500 on the 0-1000 scale is 50, which lands on 'immediate' — but with no
    // history that tier is a default, not a judgement, and must be labelled.
    expect(view?.recommendation.tier).toBe('immediate');
    expect(view?.defaulted).toBe(true);
  });

  it('flags a client with no passport at all as defaulted', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue({
      id: 'cli_1',
      name: 'No Passport',
      address: null,
      passport: null,
    });

    const view = await buildTermsRecommendation('biz_1', 'cli_1');

    expect(view?.defaulted).toBe(true);
  });

  it('includes rail reasoning when payment methods exist', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue({
      id: 'cli_1',
      name: 'Acme',
      address: 'Austin, TX, United States',
      passport: { paymentScore: 500, paymentSampleSize: 3 },
    });
    mock(prisma.businessPaymentMethod.findMany).mockResolvedValue([
      { id: 'pm_1', businessId: 'biz_1', railId: 'square', displayName: 'Square', target: 'https://square.link/x', isDefault: true },
      { id: 'pm_2', businessId: 'biz_1', railId: 'paypal', displayName: 'PayPal', target: 'https://paypal.me/x', isDefault: false },
    ]);

    const view = await buildTermsRecommendation('biz_1', 'cli_1', { amount: 150 });

    expect(view?.railReasoning).toContain('United States');
    expect(view?.clientCountry).toBe('United States');
  });

  it('stays usable when the rail preview throws', async () => {
    mock(prisma.crmClient.findUnique).mockResolvedValue({
      id: 'cli_1',
      name: 'Acme',
      address: 'Austin, TX, United States',
      passport: { paymentScore: 300, paymentSampleSize: 3 },
    });
    mock(prisma.businessPaymentMethod.findMany).mockRejectedValue(new Error('rail registry down'));

    const view = await buildTermsRecommendation('biz_1', 'cli_1');

    // Terms advice is still worth giving even if the rail preview is broken.
    expect(view?.recommendation.tier).toBe('deposit_escrow');
    expect(view?.railReasoning).toBeNull();
  });
});

describe('recordTermsDecision', () => {
  const recommended = recommendTerms(82);

  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.systemAuditLog.create).mockResolvedValue({});
    mock(prisma.crmActivity.create).mockResolvedValue({});
  });

  it('logs an acceptance without an override reason', async () => {
    await recordTermsDecision({
      businessId: 'biz_1',
      invoiceId: 'inv_1',
      clientId: 'cli_1',
      decision: { terms: 'Net-30', dueInDays: 30, requireEscrow: false, overrideReason: null, recommended },
      actorId: 'user_1',
      actorName: 'Sam',
    });

    expect(prisma.systemAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'INVOICE_TERMS_ACCEPTED', targetId: 'inv_1', actorId: 'user_1' }),
      }),
    );
    const auditData = mock(prisma.systemAuditLog.create).mock.calls[0][0].data;
    expect(auditData.metadata.overrode).toBe(false);
    expect(auditData.metadata.recommendedTier).toBe('net_30');
  });

  it('records the override reason on both audit sinks', async () => {
    await recordTermsDecision({
      businessId: 'biz_1',
      invoiceId: 'inv_2',
      clientId: 'cli_1',
      decision: {
        terms: 'Net-60',
        dueInDays: 60,
        requireEscrow: false,
        overrideReason: 'Long-standing client, agreed verbally',
        recommended,
      },
      actorId: 'user_1',
    });

    expect(prisma.systemAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'INVOICE_TERMS_OVERRIDDEN' }),
      }),
    );
    const auditData = mock(prisma.systemAuditLog.create).mock.calls[0][0].data;
    expect(auditData.metadata.overrode).toBe(true);
    expect(auditData.metadata.overrideReason).toBe('Long-standing client, agreed verbally');
    // What was recommended has to be in the record, or the override is
    // un-reviewable: you cannot tell a good override from an unexamined one.
    expect(auditData.metadata.recommendedTier).toBe('net_30');

    const activity = mock(prisma.crmActivity.create).mock.calls[0][0].data;
    expect(activity.title).toContain('Terms overridden');
    expect(activity.description).toContain('Long-standing client');
    expect(activity.clientId).toBe('cli_1');
  });

  it('does not throw when the audit write fails', async () => {
    mock(prisma.systemAuditLog.create).mockRejectedValue(new Error('audit table missing'));

    await expect(
      recordTermsDecision({
        businessId: 'biz_1',
        invoiceId: 'inv_3',
        clientId: 'cli_1',
        decision: { terms: 'Net-30', dueInDays: 30, requireEscrow: false, overrideReason: null, recommended },
      }),
    ).resolves.toBeUndefined();

    // The CrmActivity write must still be attempted — a SystemAuditLog outage
    // should not cost us the human-readable trail.
    expect(prisma.crmActivity.create).toHaveBeenCalled();
  });
});
