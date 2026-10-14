import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The most careful function in the codebase, called by nothing.
 *
 * `recordTermsDecision` writes two things on purpose: a SystemAuditLog row for the
 * machine, and a CrmActivity on the client's visible timeline for the human. Neither
 * write is in a transaction with the invoice update — an audit failure must not roll
 * back an invoice the business has already sent, while a missing audit line is
 * recoverable and an unsent invoice is not.
 *
 * It also documents an override as worthless without a reason: "why did this client
 * get net-60" has to stay answerable months later.
 *
 * Both of those properties only mean anything if something calls it, which nothing
 * did. These tests pin the behaviour now that the route does.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    invoice: { findFirst: vi.fn(), update: vi.fn() },
    crmActivity: { create: vi.fn() },
    systemAuditLog: { create: vi.fn() },
    crmServiceBusiness: { findFirst: vi.fn() },
    crmClient: { findFirst: vi.fn(), findUnique: vi.fn() },
    businessPaymentMethod: { findMany: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '../../src/utils/database';
import { recordTermsDecision } from '../../src/services/terms-recommendation.service';

const RECOMMENDED = {
  tier: 'NET_30' as const,
  label: 'Net 30',
  dueInDays: 30,
  requireEscrow: false,
  paymentScore: 82,
};

function decision(over: Partial<Parameters<typeof recordTermsDecision>[0]['decision']> = {}) {
  return {
    terms: 'Net 30',
    dueInDays: 30,
    requireEscrow: false,
    overrideReason: null,
    recommended: RECOMMENDED,
    ...over,
  };
}

const base = {
  businessId: 'biz_1',
  serviceBusinessId: 'svc_1',
  invoiceId: 'inv_1',
  clientId: 'cli_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.systemAuditLog.create as any).mockResolvedValue({});
  (prisma.crmActivity.create as any).mockResolvedValue({});
});

describe('the terms decision record', () => {
  it('writes both a machine record and a readable timeline entry', async () => {
    await recordTermsDecision({ ...base, decision: decision() });

    expect(prisma.systemAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.crmActivity.create).toHaveBeenCalledTimes(1);
    // Both writers are load-bearing: the audit row is unreadable to a human and the
    // timeline entry is not queryable by a machine.
    expect(prisma.systemAuditLog.create.mock.calls[0][0].data.action).toBe('INVOICE_TERMS_ACCEPTED');
    expect(prisma.crmActivity.create.mock.calls[0][0].data.type).toBe('NOTE');
  });

  it('anchors the timeline entry so the activity report can see it', async () => {
    await recordTermsDecision({ ...base, decision: decision() });

    // Without this the entry exists on the client page and nowhere else, and the
    // activity report scopes on serviceBusinessId only — so it would be invisible to
    // every metric while looking perfectly recorded.
    const data = (prisma.crmActivity.create as any).mock.calls[0][0].data;
    expect(data.serviceBusinessId).toBe('svc_1');
    expect(data.businessId).toBe('biz_1');
  });

  it('records what was recommended next to what was chosen', async () => {
    await recordTermsDecision({ ...base, decision: decision() });

    const meta = (prisma.systemAuditLog.create as any).mock.calls[0][0].data.metadata;
    expect(meta.recommendedDueInDays).toBe(30);
    expect(meta.chosenDueInDays).toBe(30);
    expect(meta.overrode).toBe(false);
  });

  it('distinguishes an override and keeps the reason', async () => {
    await recordTermsDecision({
      ...base,
      decision: decision({ dueInDays: 60, terms: 'Net 60', overrideReason: 'Personal guarantee' }),
    });

    const meta = (prisma.systemAuditLog.create as any).mock.calls[0][0].data.metadata;
    expect(meta.overrode).toBe(true);
    expect(meta.overrideReason).toBe('Personal guarantee');
    expect(meta.chosenDueInDays).toBe(60);
    expect(meta.recommendedDueInDays).toBe(30);
    expect((prisma.systemAuditLog.create as any).mock.calls[0][0].data.action)
      .toBe('INVOICE_TERMS_OVERRIDDEN');
  });

  it('records an escrow recommendation as advice, not as something applied', async () => {
    await recordTermsDecision({
      ...base,
      decision: decision({ requireEscrow: true }),
    });

    const meta = (prisma.systemAuditLog.create as any).mock.calls[0][0].data.metadata;
    // Escrow lives on the job, so nothing here applied it. The record says so
    // explicitly — an audit row is the thing people trust without re-reading.
    expect(meta.escrowRecommended).toBe(true);
    expect(meta.escrowAppliedOnInvoice).toBe(false);
    // The old name implied the decision had arranged escrow. It had not.
    expect(meta).not.toHaveProperty('chosenRequireEscrow');
  });

  it('still writes the timeline entry when the audit write fails', async () => {
    (prisma.systemAuditLog.create as any).mockRejectedValue(new Error('audit down'));

    await recordTermsDecision({ ...base, decision: decision() });

    // Deliberately not transactional: a missing audit line is recoverable, an unsent
    // invoice is not.
    expect(prisma.crmActivity.create).toHaveBeenCalledTimes(1);
  });

  it('does not throw when both writes fail', async () => {
    (prisma.systemAuditLog.create as any).mockRejectedValue(new Error('down'));
    (prisma.crmActivity.create as any).mockRejectedValue(new Error('down'));

    // The invoice has already been re-dated by this point. Throwing here would make
    // the caller believe the change was rolled back when it was not.
    await expect(recordTermsDecision({ ...base, decision: decision() })).resolves.toBeUndefined();
  });

  it('attributes the decision to a named actor when there is one', async () => {
    await recordTermsDecision({
      ...base,
      actorId: 'user_1',
      actorName: 'Sam',
      decision: decision(),
    });

    const activity = (prisma.crmActivity.create as any).mock.calls[0][0].data;
    expect(activity.authorName).toBe('Sam');
  });
});
describe('the route contract for applying terms', () => {
  const crmRoutes = readFileSync(
    resolve(__dirname, '../../src/routes/crm.routes.ts'),
    'utf8',
  );

  /** Just the POST /invoices/:id/terms handler. */
  function termsBlock(): string {
    const start = crmRoutes.indexOf("router.post('/invoices/:id/terms'");
    const next = crmRoutes.indexOf('\nrouter.', start + 1);
    return crmRoutes.slice(start, next === -1 ? undefined : next);
  }

  it('is registered', () => {
    expect(crmRoutes).toContain("router.post('/invoices/:id/terms'");
  });

  it('refuses an override with no reason', () => {
    // The client disables the button, but the client is the convenience layer. The
    // guarantee lives here, because "why did this client get net-60" has to stay
    // answerable months later and an unreasoned override makes it unanswerable.
    expect(termsBlock()).toContain('overrideReason.trim()');
    expect(termsBlock()).toMatch(/400/);
  });

  it('refuses to re-date a settled invoice', () => {
    // Nothing can be recovered from moving the due date of a paid or cancelled
    // invoice, and the audit would be recording a change nobody can act on.
    expect(termsBlock()).toMatch(/SETTLED/);
    expect(termsBlock()).toMatch(/409/);
  });

  it('validates the day range', () => {
    expect(termsBlock()).toMatch(/days < 0 \|\| days > 365/);
  });

  it('does not claim escrow was applied', () => {
    // Escrow lives on the job. The response says so rather than letting a caller
    // believe the invoice now has money held against it.
    expect(termsBlock()).toMatch(/escrowApplied: false/);
  });

  it('records the decision rather than only applying it', () => {
    expect(termsBlock()).toContain('recordTermsDecision(');
    expect(termsBlock()).toContain('serviceBusinessId: crm.serviceBusinessId');
  });
});
