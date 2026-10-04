import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Four routers shipped with no authentication at all: 32 routes of business financials
 * and writes — rent generation, late fees, lease renewal, inspections, maintenance
 * vendors, cashflow, API keys, payment methods, revenue and trust reports — each taking a
 * tenant from the query string.
 *
 * The test is deliberately blunt: an anonymous caller must not get past the door. Every
 * one of these returned a real answer before, so asserting on one route per router would
 * have been enough to miss a route added later; instead every route is probed.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({ jobCronService: { start: vi.fn(), stop: vi.fn() } }));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({ subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() } }));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));
vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, p) => (p === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

let baseUrl: string;
let server: Server;

const ROUTERS: Array<{ name: string; mount: string; routes: Array<[string, string]> }> = [
  {
    name: 'reports',
    mount: '/api/v1/reports',
    routes: [
      ['GET', '/pipeline'], ['GET', '/revenue'], ['GET', '/expenses'],
      ['GET', '/client-health'], ['GET', '/trust'], ['GET', '/activities'],
      // Both spellings are declared on the server, so both are probed. This list was ALWAYS
      // written as /trust and /activities -- the names the client calls -- while the router
      // registered /trust-insights and /activity-metrics. The staleness check below compares
      // COUNTS only, so 6 declared against 6 expected passed while two of the six report
      // cards on the CRM reports page were silently 404ing. Count parity is not name parity;
      // that is why the aliases exist and why both spellings are listed here.
      ['GET', '/trust-insights'], ['GET', '/activity-metrics'],
    ],
  },
  {
    name: 'apiKey',
    mount: '/api/v1/api-keys',
    routes: [['GET', '/'], ['POST', '/'], ['DELETE', '/key_1']],
  },
  {
    name: 'paymentMethods',
    mount: '/api/v1/payment-methods',
    routes: [['GET', '/'], ['POST', '/'], ['PUT', '/pm_1/default'], ['DELETE', '/pm_1']],
  },
  {
    name: 'crmAdvanced',
    mount: '/api/v1/crm-advanced',
    routes: [
      ['POST', '/rent/generate'], ['GET', '/rent/overdue'], ['POST', '/late-fees/apply'],
      ['GET', '/leases/expiring'], ['POST', '/leases/l_1/renew'], ['POST', '/inspections'],
      ['GET', '/inspections/i_1'], ['POST', '/inspections/i_1/sign'],
      ['GET', '/maintenance/auto-assign/m_1'], ['GET', '/maintenance/vendors'],
      ['POST', '/maintenance/vendors'], ['GET', '/financials/p_1'], ['GET', '/cashflow/p_1'],
      ['GET', '/tenant/t_1/risk'], ['GET', '/tenant/t_1/ledger'], ['POST', '/automations'],
      ['GET', '/automations'], ['POST', '/automations/a_1/trigger'], ['GET', '/automations/run'],
    ],
  },
];

beforeAll(async () => {
  const { default: app } = await import('../src/index');
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  const { prisma } = await import('../src/utils/database');
  await prisma.$disconnect();
});

describe('previously unauthenticated routers now require a session', () => {
  for (const router of ROUTERS) {
    describe(router.name, () => {
      it.each(router.routes)('%s %s refuses an anonymous caller', async (method, path) => {
        const res = await fetch(`${baseUrl}${router.mount}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method === 'GET' ? undefined : '{}',
        });
        expect(res.status, `${method} ${router.mount}${path} answered ${res.status}`).toBe(401);
      });
    });
  }

  it('covers every route in each of these files', async () => {
    // Guards against the list above drifting out of date as routes are added — a probe
    // list that silently omits a new route is how "all routes are protected" becomes a
    // claim nobody checked.
    const { readFileSync } = await import('node:fs');
    for (const router of ROUTERS) {
      const src = readFileSync(`src/routes/${router.name}.routes.ts`, 'utf8');
      const declared = [...src.matchAll(/^router\.(get|post|put|patch|delete)\(/gm)].length;
      expect(router.routes.length, `${router.name}: probe list is out of date`).toBe(declared);
    }
  });
});
