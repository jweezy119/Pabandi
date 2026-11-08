import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Billing / subscription — the money path for the SaaS tier.
 *
 * Properties under test:
 *
 *   - A business can read its current subscription tier (GET /subscription).
 *   - A business can read its saasCreditBalance (GET /credit-balance).
 *   - A subscription invoice is created with credit pre-applied
 *     (POST /subscription-invoice), returning netAmountCents.
 *   - When saasCreditBalance covers the full cost, the upgrade is instant
 *     with no payment required (POST /subscribe).
 *   - An invalid tier is rejected (400).
 *   - Already subscribed to the same tier is rejected (400).
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn(), findFirst: vi.fn() },
    merchantSubscription: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    crmServiceBusiness: { findUnique: vi.fn() },
    crmClient: { findFirst: vi.fn(), create: vi.fn() },
    apiClient: { findFirst: vi.fn() },
    mcpPrepaidBalance: { upsert: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/services/saasCredit.service', () => ({
  getCreditBalance: vi.fn(),
  applyCreditToInvoice: vi.fn(),
  applyCreditToAmount: vi.fn(),
}));

vi.mock('../src/services/subscription.service', () => ({
  getSubscription: vi.fn(),
}));

vi.mock('../src/services/square-connection.service', () => ({
  resolveSquareCredentials: vi.fn(),
  createSquarePaymentLink: vi.fn(),
  squareBaseUrl: vi.fn(() => 'https://api.squareup.com'),
  invoiceNote: vi.fn(() => 'pabandi:invoice:inv_1:INV-2026-SUB-0001'),
  parseInvoiceNote: vi.fn(),
}));

vi.mock('../src/services/squareCheckout.service', () => ({
  squareService: { createCheckout: vi.fn() },
}));

vi.mock('../src/middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    (_req as any).user = { id: 'user_1', businessId: 'biz_1' };
    next();
  },
}));

import { prisma } from '../src/utils/database';
import { getCreditBalance } from '../src/services/saasCredit.service';
import { applyCreditToInvoice } from '../src/services/saasCredit.service';
import { getSubscription } from '../src/services/subscription.service';
import { resolveSquareCredentials } from '../src/services/square-connection.service';
import { createSquarePaymentLink } from '../src/services/square-connection.service';
import router from '../src/routes/billing.routes';

function layer(path: string, method = 'post') {
  return (router as any).stack.find(
    (l: any) => l.route?.path === path && Object.keys(l.route.methods).includes(method),
  );
}

async function call(method: string, path: string, body: unknown) {
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'user_1', businessId: 'biz_1' };
    next();
  });
  app.use('/api/v1/billing', router);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as any).port;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'post' ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {}
  await new Promise<void>((r) => server.close(() => r()));
  return { status: res.status, body: parsed };
}

beforeEach(() => {
  vi.mocked(prisma.business.findUnique).mockReset();
  vi.mocked(prisma.merchantSubscription.findUnique).mockReset();
  vi.mocked(prisma.merchantSubscription.create).mockReset();
  vi.mocked(prisma.merchantSubscription.upsert).mockReset();
  vi.mocked(prisma.merchantSubscription.update).mockReset();
  vi.mocked(prisma.invoice.create).mockReset();
  vi.mocked(prisma.invoice.findFirst).mockReset();
  vi.mocked(prisma.invoice.findUnique).mockReset();
  vi.mocked(prisma.invoice.update).mockReset();
  vi.mocked(prisma.invoice.count).mockReset();
  vi.mocked(prisma.crmServiceBusiness.findUnique).mockReset();
  vi.mocked(prisma.crmClient.findFirst).mockReset();
  vi.mocked(prisma.crmClient.create).mockReset();
  vi.mocked(getCreditBalance).mockReset();
  vi.mocked(applyCreditToInvoice).mockReset();
  vi.mocked(getSubscription).mockReset();
  vi.mocked(resolveSquareCredentials).mockReset();
  vi.mocked(createSquarePaymentLink).mockReset();
});

describe('GET /api/v1/billing/subscription', () => {
  it('exists', () => expect(layer('/subscription', 'get')).toBeDefined());

  it('returns the current subscription for the business', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'pro',
      status: 'active',
      priceCents: 4900,
      currency: 'USD',
    } as never);

    const { status, body } = await call('get', '/api/v1/billing/subscription');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe('pro');
    expect(body.data.status).toBe('active');
  });

  it('creates a free subscription when none exists', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.merchantSubscription.create).mockResolvedValueOnce({
      id: 'sub_2',
      businessId: 'biz_1',
      tier: 'free',
      status: 'active',
    } as never);

    const { status, body } = await call('get', '/api/v1/billing/subscription');

    expect(status).toBe(200);
    expect(body.data.tier).toBe('free');
    expect(prisma.merchantSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz_1', tier: 'free', status: 'active' }),
      })
    );
  });
});

describe('GET /api/v1/billing/credit-balance', () => {
  it('exists', () => expect(layer('/credit-balance', 'get')).toBeDefined());

  it('returns the saasCreditBalance', async () => {
    vi.mocked(getCreditBalance).mockResolvedValueOnce(150.5);

    const { status, body } = await call('get', '/api/v1/billing/credit-balance');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.saasCreditBalance).toBe(150.5);
    expect(getCreditBalance).toHaveBeenCalledWith('biz_1');
  });
});

describe('POST /api/v1/billing/subscription-invoice', () => {
  it('exists', () => expect(layer('/subscription-invoice')).toBeDefined());

  it('creates a subscription invoice with credit pre-applied', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'pro',
      status: 'active',
    } as never);
    vi.mocked(prisma.crmServiceBusiness.findUnique).mockResolvedValueOnce({
      id: 'sb_1',
      businessId: 'biz_1',
    } as never);
    vi.mocked(prisma.crmClient.findFirst).mockResolvedValueOnce({ id: 'client_1' } as never);
    vi.mocked(prisma.invoice.create).mockResolvedValueOnce({
      id: 'inv_1',
      number: 'INV-2026-SUB-0001',
      businessId: 'biz_1',
      clientId: 'client_1',
      dateDue: new Date(),
      status: 'sent',
    } as never);
    vi.mocked(applyCreditToInvoice).mockResolvedValueOnce({
      application: { creditAppliedCents: 5000, netAmountCents: 4400, remainingBalanceCents: 0 },
      subtotalCents: 4900,
    } as never);

    const { status, body } = await call('post', '/api/v1/billing/subscription-invoice');

    console.log('Subscription-invoice response:', JSON.stringify({ status, body }, null, 2));

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tier).toBe('pro');
    expect(body.data.subtotalCents).toBe(4900);
    expect(body.data.creditAppliedCents).toBe(5000);
    expect(body.data.netAmountCents).toBe(4400);
    expect(prisma.invoice.create).toHaveBeenCalled();
    expect(applyCreditToInvoice).toHaveBeenCalledWith('biz_1', 'inv_1');
  });

  it('rejects a free tier with no paid subscription', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'free',
      status: 'active',
    } as never);

    const { status, body } = await call('post', '/api/v1/billing/subscription-invoice');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('free');
  });
});

describe('POST /api/v1/billing/subscribe', () => {
  it('exists', () => expect(layer('/subscribe')).toBeDefined());

  it('upgrades instantly when credit covers the full cost', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'free',
      status: 'active',
    } as never);
    vi.mocked(prisma.crmServiceBusiness.findUnique).mockResolvedValueOnce({
      id: 'sb_1',
      businessId: 'biz_1',
    } as never);
    vi.mocked(prisma.crmClient.findFirst).mockResolvedValueOnce({ id: 'client_1' } as never);
    vi.mocked(getSubscription).mockResolvedValueOnce({
      tier: 'free',
      isPaying: false,
    } as never);
    vi.mocked(getCreditBalance).mockResolvedValueOnce(149); // covers business tier ($149)
    vi.mocked(prisma.invoice.create).mockResolvedValueOnce({
      id: 'inv_1',
      number: 'INV-2026-SUB-0001',
    } as never);
    vi.mocked(applyCreditToInvoice).mockResolvedValueOnce({
      application: { creditAppliedCents: 14900, netAmountCents: 0, remainingBalanceCents: 0 },
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValueOnce({ id: 'inv_1' } as never);
    vi.mocked(prisma.merchantSubscription.upsert).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'business',
      status: 'active',
    } as never);

    const { status, body } = await call('post', '/api/v1/billing/subscribe', {
      targetTier: 'business',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.paymentRequired).toBe(false);
    expect(body.data.tier).toBe('business');
    expect(body.data.netAmountCents).toBe(0);
    expect(body.data.creditAppliedCents).toBe(14900);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: 'paid' },
    });
    expect(prisma.merchantSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz_1' },
      }),
    );
  });

  it('rejects an invalid tier', async () => {
    const { status, body } = await call('post', '/api/v1/billing/subscribe', {
      targetTier: 'platinum',
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('rejects when already subscribed to the same tier', async () => {
    vi.mocked(prisma.merchantSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_1',
      businessId: 'biz_1',
      tier: 'pro',
      status: 'active',
    } as never);
    vi.mocked(getSubscription).mockResolvedValueOnce({
      tier: 'pro',
      isPaying: true,
    } as never);

    const { status, body } = await call('post', '/api/v1/billing/subscribe', {
      targetTier: 'pro',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Already subscribed');
  });
});

describe('POST /api/v1/billing/checkout & self-serve monetization endpoints', () => {
  it('returns a real Solana USDC checkout URI without fake placeholder URLs', async () => {
    const { status, body } = await call('post', '/api/v1/billing/checkout', {
      tier: 'pro',
      paymentMethod: 'solana',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toMatch(/^solana:/);
    expect(body.checkoutUrl).not.toContain('placeholder');
    expect(body.data.amount).toBe(49);
  });

  it('generates a real Square payment link when square is requested', async () => {
    vi.mocked(resolveSquareCredentials).mockResolvedValueOnce({
      accessToken: 'sq0atp-test-token',
      locationId: 'LOC123',
      source: 'platform',
    } as any);

    vi.mocked(createSquarePaymentLink).mockResolvedValueOnce({
      url: 'https://square.link/u/test-sub-url',
      paymentLinkId: 'plink_123',
      orderId: 'order_123',
    } as any);

    const { status, body } = await call('post', '/api/v1/billing/checkout', {
      tier: 'business',
      paymentMethod: 'square',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.checkoutUrl).toBe('https://square.link/u/test-sub-url');
    expect(body.data.paymentMethod).toBe('square');
    expect(body.data.amount).toBe(149);
  });

  it('automatically resolves to live Square when paymentMethod is omitted and Square is available', async () => {
    vi.mocked(resolveSquareCredentials).mockResolvedValueOnce({
      accessToken: 'sq0atp-test-token',
      locationId: 'LOC123',
      source: 'platform',
    } as any);

    vi.mocked(createSquarePaymentLink).mockResolvedValueOnce({
      url: 'https://square.link/u/test-live-auto',
      paymentLinkId: 'plink_auto',
      orderId: 'order_auto',
    } as any);

    const { status, body } = await call('post', '/api/v1/billing/checkout', {
      tier: 'starter',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.paymentMethod).toBe('square');
    expect(body.checkoutUrl).toBe('https://square.link/u/test-live-auto');
    expect(body.data.amount).toBe(19);
  });

  it('automatically resolves to live Solana USDC when paymentMethod is omitted and Square is unavailable', async () => {
    vi.mocked(resolveSquareCredentials).mockResolvedValueOnce(null);

    const { status, body } = await call('post', '/api/v1/billing/checkout', {
      tier: 'pro',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.paymentMethod).toBe('solana');
    expect(body.checkoutUrl).toMatch(/^solana:/);
    expect(body.data.amount).toBe(49);
  });

  it('quotes a self-serve MCP prepaid USDC top-up', async () => {
    const { status, body } = await call('post', '/api/v1/billing/mcp-topup/quote', {
      amountUsdc: 25,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.amountUsdc).toBe(25);
    expect(body.data.estimatedToolCalls).toBe(25000);
    expect(body.data.checkoutUrl).toMatch(/^solana:/);
  });

  it('quotes a $9 Counterparty Litigation & Trust Dossier', async () => {
    vi.mocked((prisma.business as any).findFirst).mockResolvedValueOnce({
      id: 'matthews-roofing-chicago',
      name: 'Matthews Roofing Company',
      city: 'Chicago',
      category: 'ROOFING',
      trustScore: 95,
    } as never);

    const { status, body } = await call('post', '/api/v1/billing/trust-dossier/quote', {
      businessId: 'matthews-roofing-chicago',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(9);
    expect(body.data.checkoutUrl).toMatch(/^solana:/);
  });
});
