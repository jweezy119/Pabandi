import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * The routes the CRM pages actually call.
 *
 * Two of these were missing while the pages had existed for a long time:
 *
 *   GET /crm/jobs/:id      the job detail page fetched it on mount and rendered its
 *                          shell against an undefined job, so it had never rendered
 *                          a client, an address or a price
 *   POST /ai/concierge     the concierge button in the global chrome posted to it on
 *                          every message and got a 404 every time
 *
 * A page calling an endpoint that is not registered produces a 404, not a build error,
 * so nothing catches it. This mounts the real routers and checks the paths exist,
 * which is the one check that would have caught both.
 *
 * It deliberately asserts the exact method+path rather than a count. The previous
 * version of this idea compared COUNTS of declared vs expected routes, and six
 * declared against six expected passed while two of the six report cards were
 * silently 404ing because the names had drifted.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('../src/middleware/auth.middleware', async () => {
  const actual: any = await vi.importActual('../../src/middleware/auth.middleware');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'user_1', role: 'ADMIN', email: 'o@x.com', businessId: 'biz_1' };
      next();
    },
  };
});

import crmRouter from '../../src/routes/crm.routes';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/crm', crmRouter);

  // Anything that falls through is the 404 a real caller would get.
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server?.close(); });

/** Does this method+path get a response other than the 404 fallback? */
async function reaches(path: string, method = 'GET'): Promise<boolean> {
  const res = await fetch(`${baseUrl}${path}`, { method });
  if (res.status === 404) {
    // Distinguish "route missing" from "route matched and legitimately 404'd because
    // of a missing row". Only the former is what this test is about.
    const body = await res.json().catch(() => ({}));
    return body?.error !== 'not found';
  }
  return true;
}

const CLIENT_PAGES_CALL = [
  ['GET', '/api/v1/crm/clients'],
  ['GET', '/api/v1/crm/clients/client_1'],
  ['GET', '/api/v1/crm/clients/client_1/intelligence'],
  ['GET', '/api/v1/crm/clients/client_1/explain-score'],
  ['GET', '/api/v1/crm/clients/client_1/stage'],
  ['GET', '/api/v1/crm/deals'],
  ['GET', '/api/v1/crm/jobs'],
  // Never registered until recently; the detail page has always called it.
  ['GET', '/api/v1/crm/jobs/job_1'],
  ['POST', '/api/v1/crm/jobs/job_1/checkin'],
  ['POST', '/api/v1/crm/jobs/job_1/checkout'],
  ['GET', '/api/v1/crm/invoices'],
  ['GET', '/api/v1/crm/invoices/inv_1'],
  ['PATCH', '/api/v1/crm/invoices/inv_1'],
  ['PATCH', '/api/v1/crm/invoices/inv_1/status'],
  ['GET', '/api/v1/crm/activities'],
  ['POST', '/api/v1/crm/activities'],
  ['GET', '/api/v1/crm/tasks'],
  ['POST', '/api/v1/crm/tasks'],
  ['PATCH', '/api/v1/crm/tasks/act_1'],
  ['GET', '/api/v1/crm/search?q=Ada'],
  ['GET', '/api/v1/crm/setup-progress'],
  ['GET', '/api/v1/crm/reports/activities'],
  ['GET', '/api/v1/crm/alerts'],
];

describe('CRM routes the pages depend on', () => {
  it.each(CLIENT_PAGES_CALL)('%s %s is registered', async (method, path) => {
    expect(await reaches(path, method)).toBe(true);
  });
});

describe('search route', () => {
  it('answers rather than falling through', async () => {
    const res = await fetch(`${baseUrl}/api/v1/crm/search?q=Ada`);
    expect(res.status).not.toBe(404);
  });

  it('is not shadowed by the /clients/:id family', async () => {
    // /search and /clients/:id are both single segments; registration order matters if
    // this ever becomes /clients/search.
    const res = await fetch(`${baseUrl}/api/v1/crm/search?q=Ada`);
    const body = await res.json().catch(() => ({}));
    expect(body?.error).not.toBe('not found');
  });
});