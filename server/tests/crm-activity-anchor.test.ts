import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * The column nobody wrote, and the metrics that read it.
 *
 * CrmActivity has two tenant anchors: `businessId`, documented as the legacy
 * CrmBusiness key, and `serviceBusinessId`, the current anchor. Every create path
 * in the codebase took the tenant from the token's platform `Business.id` and
 * wrote it into the legacy column. `serviceBusinessId` was never written by
 * anything -- not the activity route, not the task route, not the terms-decision
 * audit write.
 *
 * reports.service.ts reads activity metrics through `crmScope()`, which is
 * `{ serviceBusinessId }` and nothing else. Its comment explains the choice: ORing
 * in the platform id would add a clause that can never match.
 *
 * So the two sides disagreed. The Activities page listed a tenant's history; the
 * activity report counted none of it, for any tenant, ever. Nothing errored. The
 * dashboard simply reported zero.
 *
 * These tests assert the write, the read scope, and the tenant boundary that the
 * move from the token to `resolveCrmBusiness` newly relies on.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmActivity: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    crmServiceBusiness: { findFirst: vi.fn() },
  },
}));
// `authenticate` is replaced so the test can drive the tenant resolution that follows
// it. `resolveCrmBusiness` stays real — it is the thing under test.
vi.mock('../src/middleware/auth.middleware', async () => {
  const actual: any = await vi.importActual('../src/middleware/auth.middleware');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      const raw = req.headers.authorization?.replace('Bearer ', '');
      req.user = raw ? JSON.parse(Buffer.from(raw, 'base64').toString()) : undefined;
      next();
    },
  };
});
vi.mock('../src/trust/trust-core', () => ({ trustCore: { emit: vi.fn() } }));
vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import activityRouter from '../src/routes/activity.routes';
import taskRouter from '../src/routes/task.routes';
import { prisma } from '../src/utils/database';

const SVC = 'svc_current';
const PLATFORM = 'biz_platform';
const OWNER = 'user_1';

let server: Server;
let baseUrl: string;

async function listen(app: express.Express): Promise<void> {
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** An enrolled owner. `serviceBusinessId` is the id, `businessId` the platform one. */
function enrolled(businessId: string | null = PLATFORM) {
  (prisma.crmServiceBusiness.findFirst as any).mockResolvedValue({
    id: SVC,
    businessId,
    ownerId: OWNER,
  });
}

/** A caller with a token but no enrolled service business. */
function notEnrolled() {
  (prisma.crmServiceBusiness.findFirst as any).mockResolvedValue(null);
}

function token(businessId: string | null = PLATFORM): Record<string, string> {
  const claims = { id: OWNER, email: 'o@x.com', role: 'ADMIN' } as Record<string, unknown>;
  if (businessId) claims.businessId = businessId;
  return { Authorization: `Bearer ${Buffer.from(JSON.stringify(claims)).toString('base64')}` };
}

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/activities', activityRouter);
  a.use('/tasks', taskRouter);
  return a;
};

beforeEach(async () => {
  vi.clearAllMocks();
  (prisma.crmActivity.create as any).mockResolvedValue({ id: 'act_1', client: null });
  (prisma.crmActivity.findMany as any).mockResolvedValue([]);
  (prisma.crmActivity.updateMany as any).mockResolvedValue({ count: 0 });
  if (!server) await listen(app());
});

describe('CrmActivity serviceBusinessId anchor', () => {
  it('writes serviceBusinessId on activity create, not only the legacy anchor', async () => {
    enrolled();
    const res = await fetch(`${baseUrl}/activities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...token() },
      body: JSON.stringify({ title: 'Called about the invoice' }),
    });
    expect(res.status).toBe(201);

    const data = (prisma.crmActivity.create as any).mock.calls[0][0].data;
    // The column the activity report scopes on.
    expect(data.serviceBusinessId).toBe(SVC);
    // The legacy column is still written, so the cross-layer joins still resolve.
    expect(data.businessId).toBe(PLATFORM);
  });

  it('writes serviceBusinessId on task create too — tasks are activities', async () => {
    enrolled();
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...token() },
      body: JSON.stringify({ title: 'Chase payment' }),
    });
    expect(res.status).toBe(201);

    const data = (prisma.crmActivity.create as any).mock.calls[0][0].data;
    expect(data.serviceBusinessId).toBe(SVC);
    expect(data.type).toBe('TASK');
  });

  it('scopes the activity list on the current anchor', async () => {
    enrolled();
    await fetch(`${baseUrl}/activities`, { headers: token() });

    const where = (prisma.crmActivity.findMany as any).mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ serviceBusinessId: SVC });
    expect(where.OR).toContainEqual({ businessId: PLATFORM });
  });

  it('keeps pre-fix rows readable — they carry only the legacy anchor', async () => {
    enrolled();
    await fetch(`${baseUrl}/activities`, { headers: token() });

    // The OR is the whole reason this is not a one-column filter. Rows written before
    // the fix have serviceBusinessId = null, and a serviceBusinessId-only predicate
    // would silently empty every existing tenant's history.
    const where = (prisma.crmActivity.findMany as any).mock.calls[0][0].where;
    expect(where.OR.some((c: any) => 'businessId' in c)).toBe(true);
  });

  it('scopes the task list and the task update on the same anchor', async () => {
    enrolled();
    await fetch(`${baseUrl}/tasks`, { headers: token() });
    expect((prisma.crmActivity.findMany as any).mock.calls[0][0].where.OR)
      .toContainEqual({ serviceBusinessId: SVC });

    await fetch(`${baseUrl}/tasks/act_1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...token() },
      body: JSON.stringify({ status: 'DONE' }),
    });
    const where = (prisma.crmActivity.updateMany as any).mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ serviceBusinessId: SVC });
    expect(where.type).toBe('TASK');
  });

  it('403s an unenrolled caller instead of 500ing', async () => {
    notEnrolled();
    const res = await fetch(`${baseUrl}/activities`, { headers: token(null) });
    expect(res.status).toBe(403);
    // A match-all would be the dangerous outcome here: this row type is the whole
    // activity ledger.
    expect((prisma.crmActivity.findMany as any)).not.toHaveBeenCalled();
  });

  it('still rejects an out-of-vocabulary activity type', async () => {
    enrolled();
    const res = await fetch(`${baseUrl}/activities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...token() },
      body: JSON.stringify({ title: 'x', type: 'Call' }),
    });
    expect(res.status).toBe(400);
  });
});