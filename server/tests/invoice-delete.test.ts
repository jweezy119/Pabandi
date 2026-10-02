import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/database';
import crmRouter from '../src/routes/crm.routes';

/**
 * Draft invoice deletion, over real HTTP.
 *
 * DELETE /crm/invoices/:id existed, was correctly tenant-scoped, and had no
 * caller anywhere in the UI — a mistyped draft invoice was unremovable. These
 * tests pin what the new UI depends on, plus the two ways the old handler was
 * loose: it read the status and then deleted in two statements (a window where
 * a just-sent invoice could be lost), and compared status case-sensitively while
 * the rest of the codebase is inconsistent about casing.
 */

const SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = SECRET;

vi.mock('../src/utils/database', () => ({
  prisma: {
    invoice: { findFirst: vi.fn(), deleteMany: vi.fn() },
    // crm.routes mounts resolveCrmBusiness, which reads this table to scope every
    // request to the caller's own business. Without it the middleware throws and
    // the suite sees a 500 HTML page instead of the handler's real response.
    // Must resolve, not be null: resolveCrmBusiness 403s the request when no
    // service business is enrolled, which masks every handler assertion behind
    // the same status code. The row links back to the same business the token
    // carries so getBusinessId's mismatch guard sees no disagreement.
    crmServiceBusiness: {
      findFirst: vi.fn().mockImplementation(() =>
        Promise.resolve({ id: 'csb_1', businessId: BUSINESS, ownerId: 'u1' }),
      ),
    },
  },
}));

vi.mock('../src/services/referral-fee-share.service', () => ({
  referralFeeShareService: { creditReferrer: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const BUSINESS = 'biz_1';
const OTHER_BUSINESS = 'biz_victim';

function tokenFor(businessId: string) {
  return jwt.sign({ id: 'u1', email: 'owner@example.com', role: 'USER', businessId }, SECRET);
}

const app = express();
app.use(express.json());
// Injected per-request by `as` below.
app.use((req, _res, next) => next());
app.use('/api/v1/crm', crmRouter);

let server: Server;

/** Perform a real request, so routing and middleware actually run. */
async function req(
  method: string,
  path: string,
  opts: { businessId?: string | null; body?: unknown } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.businessId !== null) {
    headers.Authorization = `Bearer ${tokenFor(opts.businessId ?? BUSINESS)}`;
  }

  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

let port = 0;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('DELETE /api/v1/crm/invoices/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a draft invoice belonging to the caller', async () => {
    mock(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv_1', number: 'INV-0001', status: 'draft' });
    mock(prisma.invoice.deleteMany).mockResolvedValue({ count: 1 });

    const { status, body } = await req('DELETE', `/api/v1/crm/invoices/inv_1?businessId=${BUSINESS}`);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // The write carries the tenant, so it cannot reach another tenant's row.
    expect(mock(prisma.invoice.deleteMany)).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'inv_1', businessId: BUSINESS }),
    });
  });

  it('resolves the tenant from the token when the query param is absent', async () => {
    mock(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv_1', number: 'INV-0001', status: 'draft' });
    mock(prisma.invoice.deleteMany).mockResolvedValue({ count: 1 });

    const { status } = await req('DELETE', '/api/v1/crm/invoices/inv_1');

    expect(status).toBe(200);
    expect(mock(prisma.invoice.deleteMany)).toHaveBeenCalledWith({
      where: expect.objectContaining({ businessId: BUSINESS }),
    });
  });

  it('refuses to delete a sent invoice', async () => {
    mock(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv_2', number: 'INV-0002', status: 'sent' });

    const { status, body } = await req('DELETE', `/api/v1/crm/invoices/inv_2?businessId=${BUSINESS}`);

    expect(status).toBe(400);
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
    expect(String(body.error)).toMatch(/draft/i);
  });

  it('404s when the scoped lookup finds nothing', async () => {
    // The lookup is tenant-scoped, so an invoice belonging to another business
    // is simply not found under this tenant. It must 404 and never delete.
    // (A *mismatched* businessId is caught earlier and 403s — see below.)
    mock(prisma.invoice.findFirst).mockResolvedValue(null);

    const { status } = await req('DELETE', `/api/v1/crm/invoices/inv_3?businessId=${BUSINESS}`);

    expect(status).toBe(404);
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the caller, not the requested id', async () => {
    mock(prisma.invoice.findFirst).mockResolvedValue(null);

    await req('DELETE', `/api/v1/crm/invoices/inv_3?businessId=${BUSINESS}`);

    // If this ever stops including businessId, the route reads any tenant's
    // invoice by guessing an id.
    expect(mock(prisma.invoice.findFirst)).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'inv_3', businessId: BUSINESS }),
      select: expect.anything(),
    });
  });

  it('refuses a businessId that disagrees with the token', async () => {
    // The cross-tenant case. The guard must reject it rather than honour the
    // query param.
    const { status } = await req('DELETE', `/api/v1/crm/invoices/inv_4?businessId=${OTHER_BUSINESS}`);

    expect(status).toBe(403);
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { status } = await req('DELETE', `/api/v1/crm/invoices/inv_9?businessId=${BUSINESS}`, {
      businessId: null,
    });
    expect(status).toBe(401);
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
  });

  it('reports a conflict when the invoice changed between check and delete', async () => {
    // Someone sent the invoice in the window between the draft read and the
    // write. The re-check inside deleteMany means it is not deleted, and the
    // user is told to reload rather than silently losing a sent invoice.
    mock(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv_5', number: 'INV-0005', status: 'draft' });
    mock(prisma.invoice.deleteMany).mockResolvedValue({ count: 0 });

    const { status, body } = await req('DELETE', `/api/v1/crm/invoices/inv_5?businessId=${BUSINESS}`);

    expect(status).toBe(409);
    expect(String(body.error)).toMatch(/reload/i);
  });

  it('treats an uppercase DRAFT as a draft', async () => {
    // Casing is inconsistent in this codebase — invoiceGeneration wrote 'SENT',
    // the service writes 'sent'. A literal `!== 'draft'` made an uppercase
    // draft permanently undeletable.
    mock(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv_6', number: 'INV-0006', status: 'DRAFT' });
    mock(prisma.invoice.deleteMany).mockResolvedValue({ count: 1 });

    const { status } = await req('DELETE', `/api/v1/crm/invoices/inv_6?businessId=${BUSINESS}`);

    expect(status).toBe(200);
  });
});
