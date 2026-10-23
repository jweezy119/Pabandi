import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/utils/database';

/**
 * The staked arbitrator panel (commit 3), exercised against a real HTTP server
 * (the repo tests over the wire, not in-process). The thing under test is the
 * GATE: a passport without `isArbitrator` cannot move escrowed funds no
 * matter what it claims in its body, and the flag lives on the passport row —
 * voted credentials do not travel in the request.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// `authenticate` is replaced — the panel gate lives on the PASSPORT row (not
// the bearer token), so driving a synthetic user into req.user keeps the test
// on the authorization logic that matters.
vi.mock('../src/middleware/auth.middleware', async () => {
  const actual = await vi.importActual<typeof import('../src/middleware/auth.middleware')>('../src/middleware/auth.middleware');
  return {
    ...actual,
    authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: 'sulha-panel-test-user' };
      next();
    },
  };
});

const { default: sulhaRouter } = await import('../src/routes/sulha.routes');
const { sulhaService } = await import('../src/services/sulha.service');

const app = express();
app.use(express.json());
app.use('/api/v1/sulha', sulhaRouter);

let baseUrl = '';
let httpServer: http.Server | undefined;

beforeAll(async () => {
  await prisma.$connect();
  // The passport rows make the trust-event FKs and the panel gate both real.
  await prisma.trustPassport.upsert({
    where: { id: PASSPORT_ARI },
    update: { isArbitrator: true, arbitratorSince: new Date() },
    create: { id: PASSPORT_ARI, handle: HANDLE_ARI, displayName: 'Panel Arbitrator', isArbitrator: true, arbitratorSince: new Date() },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  httpServer = server;
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}/api/v1/sulha`;
});

afterAll(async () => {
  await prisma.trustPassport.deleteMany({ where: { id: { startsWith: 'sulha-panel-' } } });
  await prisma.escrowDispute.deleteMany({ where: { escrowId: { startsWith: 'sulha-panel-escrow' } } });
  await prisma.universalEscrow.deleteMany({ where: { referenceId: { startsWith: 'sulha-panel-escrow' } } });
  await prisma.$disconnect();
  if (httpServer) await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
});

/** fetch wrapper decoupling tests from the server's base URL. */
async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

const PASSPORT_A = 'sulha-panel-passport-buyer';
const PASSPORT_ARI = 'sulha-panel-passport-arbitrator';
const HANDLE_ARI = 'sulha-panel-arbitrator';

let escrowSeq = 0;

async function makeEscrowAndDispute(status = 'human_review') {
  escrowSeq += 1;
  const referenceId = `sulha-panel-escrow-${escrowSeq}`;
  await prisma.universalEscrow.create({
    data: {
      referenceId,
      template: 'freelance',
      parties: [
        { partyId: PASSPORT_A, role: 'buyer' },
        { partyId: PASSPORT_ARI, role: 'seller' },
      ] as object,
      amount: 300,
      currency: 'USDC',
      conditions: [{ type: 'manual', verify: {} }] as object,
      status: 'disputed',
    } as never,
  });
  // Created directly (not through raiseDispute) with the escalated status the
  // panel actually sees — the freeze path belongs to commit 1's suite.
  return prisma.escrowDispute.create({
    data: {
      escrowId: referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Panel queue test',
      evidenceJson: {} as object,
      status,
    },
  });
}

beforeEach(async () => {
  // Every case starts unresolved and the arbitrator is an arbitrator; tests
  // that need a non-arbitrator passport create one locally.
  await prisma.trustPassport.update({ where: { id: PASSPORT_ARI }, data: { isArbitrator: true, arbitratorSince: new Date() } });
});

describe('GET /api/v1/sulha/panel/queue', () => {
  it('lists unresolved disputes for the dashboard', async () => {
    const dispute = await makeEscrowAndDispute('human_review');
    const res = await call('GET', '/panel/queue');
    expect(res.status).toBe(200);
    const ids = ((res.body.data as { queue: Array<{ id: string }> }).queue ?? []).map((d) => d.id);
    expect(ids).toContain(dispute.id);
  });

  it('never lists resolved disputes — the queue is only open cases', async () => {
    // Resolved cases live wherever they resolved; the local test DB is swept
    // per-suite, so asserting on the shape of exclusion is the honest check.
    const res = await call('GET', '/panel/queue');
    const statuses = ((res.body.data as { queue: Array<{ status: string }> }).queue ?? []).map((d) => d.status);
    expect(statuses.every((s) => ['open', 'ai_review', 'human_review'].includes(s))).toBe(true);
  });
});

describe('POST /api/v1/sulha/panel/:id/resolve', () => {
  it('a staked arbitrator releases to the seller, which settles the escrow', async () => {
    const dispute = await makeEscrowAndDispute('human_review');
    const res = await call('POST', `/panel/${dispute.id}/resolve`, {
      passportId: PASSPORT_ARI,
      verdict: 'seller',
      note: 'Delivery attested on chain',
    });

    expect(res.status).toBe(200);
    expect((res.body.data as { dispute: { status: string; resolutionNotes: string } }).dispute.status).toBe('resolved_seller');
    expect((res.body.data as { dispute: { resolutionNotes: string } }).dispute.resolutionNotes).toContain('Panel ruling');

    const escrow = await prisma.universalEscrow.findUnique({ where: { referenceId: dispute.escrowId } });
    expect(escrow?.status).toBe('released');

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    const votes = (after?.panelVotes as Array<Record<string, unknown>>) ?? [];
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ passportId: PASSPORT_ARI, vote: 'seller' });
    expect(after?.resolvedAt).not.toBeNull();
  });

  it('a staked arbitrator acting by HANDLE can refund the buyer', async () => {
    const dispute = await makeEscrowAndDispute('human_review');
    const res = await call('POST', `/panel/${dispute.id}/resolve`, {
      passportId: HANDLE_ARI,
      verdict: 'buyer',
    });

    expect(res.status).toBe(200);
    expect((res.body.data as { dispute: { status: string } }).dispute.status).toBe('resolved_buyer');
    const escrow = await prisma.universalEscrow.findUnique({ where: { referenceId: dispute.escrowId } });
    expect(escrow?.status).toBe('refunded');
  });

  it('a non-arbitrator passport cannot rule — 403 and the escrow stays frozen', async () => {
    const stranger = await prisma.trustPassport.create({
      data: { id: 'sulha-panel-passport-stranger', handle: 'sulha-panel-stranger', displayName: 'Not A Panelist', isArbitrator: false },
    });
    const dispute = await makeEscrowAndDispute('human_review');
    const res = await call('POST', `/panel/${dispute.id}/resolve`, {
      passportId: stranger.id,
      verdict: 'seller',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_ARBITRATOR');

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).not.toMatch(/^resolved/);
    const escrow = await prisma.universalEscrow.findUnique({ where: { referenceId: dispute.escrowId } });
    expect(escrow?.status).toBe('disputed');

    await prisma.escrowDispute.delete({ where: { id: dispute.id } });
    await prisma.universalEscrow.delete({ where: { referenceId: dispute.escrowId } });
    await prisma.trustPassport.delete({ where: { id: stranger.id } });
  });

  it('a resolved dispute cannot be ruled on twice', async () => {
    const dispute = await makeEscrowAndDispute('human_review');
    await call('POST', `/panel/${dispute.id}/resolve`, { passportId: PASSPORT_ARI, verdict: 'seller' });
    const res = await call('POST', `/panel/${dispute.id}/resolve`, { passportId: PASSPORT_ARI, verdict: 'buyer' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DISPUTE_ALREADY_RESOLVED');
  });
});
