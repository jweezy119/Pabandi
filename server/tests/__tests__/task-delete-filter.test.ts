import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * The two things a task list could not do.
 *
 * There was no DELETE anywhere on /crm/tasks. The board and the list both offered a
 * TODO/DONE toggle and nothing else, so a task created by mistake stayed on the board
 * forever — and the only way to stop seeing it was to mark it complete, which is a
 * claim about work done that was not done.
 *
 * status and priority were both stored, both validated on write, and both
 * unfilterable: the board showed every task regardless of which column it sat in.
 *
 * The delete endpoint is scoped, and it deliberately emits no trust event —
 * `activity.task_completed` is a record of work done, and scoring someone's
 * reliability on something they deleted would let a score be improved by removing the
 * evidence behind it.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('../../src/middleware/auth.middleware', async () => {
  const actual: any = await vi.importActual('../../src/middleware/auth.middleware');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'user_1', role: 'ADMIN', email: 'o@x.com', businessId: 'biz_1' };
      next();
    },
  };
});

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    crmServiceBusiness: { findFirst: vi.fn() },
  },
}));
vi.mock('../../src/trust/trust-core', () => ({ trustCore: { emit: vi.fn() } }));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import taskRouter from '../../src/routes/task.routes';
import { prisma } from '../../src/utils/database';
import { trustCore } from '../../src/trust/trust-core';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/crm/tasks', taskRouter);
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server?.close(); });

/** An enrolled owner, so resolveCrmBusiness resolves a tenant. */
function enrolled() {
  (prisma.crmServiceBusiness.findFirst as any).mockResolvedValue({
    id: 'svc_1', businessId: 'biz_1', ownerId: 'user_1',
  });
}

const del = (id: string) =>
  fetch(`${baseUrl}/api/v1/crm/tasks/${id}`, { method: 'DELETE' });

describe('deleting a task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.crmActivity.deleteMany as any).mockResolvedValue({ count: 1 });
    enrolled();
  });

  it('is registered', async () => {
    const res = await del('act_1');
    expect(res.status).not.toBe(404);
  });

  it('scopes the delete to the tenant and to TASK rows', async () => {
    // updateMany/deleteMany with no predicate is the same class of bug the PATCH
    // handler already had: it would delete any task by guessed id.
    await del('act_1');

    const where = (prisma.crmActivity.deleteMany as any).mock.calls[0][0].where;
    expect(where.id).toBe('act_1');
    expect(where.type).toBe('TASK');
    expect(JSON.stringify(where)).toContain('serviceBusinessId');
  });

  it('404s rather than succeeding when the row belongs to someone else', async () => {
    // deleteMany reports a count, not a row, so a tenant miss is a count of 0.
    (prisma.crmActivity.deleteMany as any).mockResolvedValue({ count: 0 });
    const res = await del('act_other');
    expect(res.status).toBe(404);
  });

  it('emits no trust event', async () => {
    await del('act_1');

    // Completing a task is evidence of work done. Deleting one is an erasure, and a
    // reliability score that improves when the record is removed is a score that can
    // be gamed by removing records.
    expect(trustCore.emit).not.toHaveBeenCalled();
  });
});

describe('filtering tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.crmActivity.findMany as any).mockResolvedValue([]);
    enrolled();
  });

  const list = async (qs: string) => {
    const res = await fetch(`${baseUrl}/api/v1/crm/tasks${qs}`);
    return (prisma.crmActivity.findMany as any).mock.calls[0][0].where;
  };

  it('always scopes to the tenant and to TASK', async () => {
    const where = await list('');
    expect(where.type).toBe('TASK');
    expect(JSON.stringify(where)).toContain('serviceBusinessId');
  });

  it('filters by status', async () => {
    const where = await list('?status=IN_PROGRESS');
    expect(where.status).toBe('IN_PROGRESS');
  });

  it('filters by priority', async () => {
    const where = await list('?priority=HIGH');
    expect(where.priority).toBe('HIGH');
  });

  it('ignores a status outside the closed set rather than filtering to nothing', async () => {
    // Validated against the same set the create path enforces. An unchecked filter
    // would return an empty list for a typo, which reads as "you have no tasks".
    const where = await list('?status=urgent');
    expect(where.status).toBeUndefined();
  });

  it('ignores a priority outside the closed set', async () => {
    const where = await list('?priority=URGENT');
    expect(where.priority).toBeUndefined();
  });

  it('combines filters', async () => {
    const where = await list('?status=TODO&priority=HIGH');
    expect(where.status).toBe('TODO');
    expect(where.priority).toBe('HIGH');
  });
});

describe('the route file says why', () => {
  it('documents that delete emits no trust event', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/routes/task.routes.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/Deliberately emits no trust event/);
  });
});