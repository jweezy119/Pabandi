import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '../src/utils/database';
import { sulhaService, SulhaError, DISPUTE_OPEN_STATUSES } from '../src/services/sulha.service';
import engineService from '../src/services/engine.service';
import type { UniversalEscrow } from '@prisma/client';

/**
 * Sulha (Optimistic Arbitration) — the dispute record layer, exercised against
 * the local database. Like engine.service.test.ts, the correctness claims here
 * are about real state transitions (freeze, block, unfreeze) and real
 * constraints (one dispute per escrow), and neither is observable through a
 * mock: a mocked unique index is an assertion that the mock has a unique index.
 */

const PASSPORT_A = 'sulha-test-passport-buyer';
const PASSPORT_B = 'sulha-test-passport-seller';
const PASSPORT_C = 'sulha-test-passport-stranger';

let escrowSeq = 0;

async function makeEscrow(overrides: Partial<{ status: string; parties: unknown }> = {}): Promise<UniversalEscrow> {
  escrowSeq += 1;
  const referenceId = `sulha-test-escrow-${escrowSeq}`;
  return prisma.universalEscrow.create({
    data: {
      referenceId,
      template: 'custom',
      parties: (overrides.parties ?? [
        { partyId: PASSPORT_A, role: 'buyer' },
        { partyId: PASSPORT_B, role: 'seller' },
      ]) as object,
      amount: 250,
      currency: 'USDC',
      conditions: [{ type: 'manual', verify: {} }] as object,
      status: overrides.status ?? 'funded',
    } as never,
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Order matters: the dispute is the child record; clearing escrows first is
  // harmless on an empty table but keeps the suite re-runnable either way.
  await prisma.escrowDispute.deleteMany({ where: { escrowId: { startsWith: 'sulha-test-escrow' } } });
  await prisma.universalEscrow.deleteMany({ where: { referenceId: { startsWith: 'sulha-test-escrow' } } });
  await prisma.pabandiSession.deleteMany({ where: { ownerId: 'sulha-test-owner' } });
});

describe('raiseDispute', () => {
  it('freezes a live escrow at `disputed` and opens the dispute', async () => {
    const escrow = await makeEscrow({ status: 'in_progress' });
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Goods not delivered',
      evidenceJson: { urls: ['https://example.test/photo.jpg'] },
    });

    expect(dispute.status).toBe('open');
    expect(dispute.escrowId).toBe(escrow.referenceId);
    expect(dispute.resolvedAt).toBeNull();

    const frozen = await prisma.universalEscrow.findUnique({ where: { referenceId: escrow.referenceId } });
    expect(frozen?.status).toBe('disputed');
  });

  it('refuses to open a second dispute on the same escrow', async () => {
    const escrow = await makeEscrow();
    await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'First case',
      evidenceJson: {},
    });

    await expect(
      sulhaService.raiseDispute({
        escrowId: escrow.referenceId,
        raisedByPassport: PASSPORT_B,
        reason: 'Counter-dispute',
        evidenceJson: {},
      })
    ).rejects.toMatchObject({ code: 'DISPUTE_ALREADY_OPEN' });
  });

  it('refuses to dispute a settled escrow — the funds are already gone', async () => {
    const escrow = await makeEscrow({ status: 'released' });
    await expect(
      sulhaService.raiseDispute({
        escrowId: escrow.referenceId,
        raisedByPassport: PASSPORT_A,
        reason: 'Too late',
        evidenceJson: {},
      })
    ).rejects.toMatchObject({ code: 'ESCROW_NOT_DISPUTABLE' });

    const after = await prisma.universalEscrow.findUnique({ where: { referenceId: escrow.referenceId } });
    expect(after?.status).toBe('released');
  });

  it('refuses to dispute an escrow that does not exist', async () => {
    await expect(
      sulhaService.raiseDispute({
        escrowId: 'does-not-exist-at-all',
        raisedByPassport: PASSPORT_A,
        reason: 'Phantom',
        evidenceJson: {},
      })
    ).rejects.toMatchObject({ code: 'ESCROW_NOT_FOUND' });
  });
});

describe('appendEvidence', () => {
  it('appends for the raiser without losing the original evidence', async () => {
    const escrow = await makeEscrow();
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Wrong item',
      evidenceJson: { urls: ['https://example.test/original.jpg'], hashes: ['abc123'] },
    });

    const updated = await sulhaService.appendEvidence(dispute.id, PASSPORT_A, {
      urls: ['https://example.test/followup.jpg'],
    });

    const original = (updated.evidenceJson as { original?: { urls?: string[] } }).original;
    const appended = (updated.evidenceJson as { appended?: Array<Record<string, unknown>> }).appended;
    expect(original?.urls).toEqual(['https://example.test/original.jpg']);
    expect(appended).toHaveLength(1);
    expect(appended?.[0]?.evidence).toEqual({ urls: ['https://example.test/followup.jpg'] });

    // And a second append stacks, it does not overwrite.
    const twice = await sulhaService.appendEvidence(dispute.id, PASSPORT_B, { notes: 'seller reply' });
    expect(((twice.evidenceJson as { appended?: unknown[] }).appended ?? []).length).toBe(2);
  });

  it('refuses evidence from a passport that is not a party to the escrow', async () => {
    const escrow = await makeEscrow();
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Party-gated test',
      evidenceJson: {},
    });

    await expect(
      sulhaService.appendEvidence(dispute.id, PASSPORT_C, { notes: 'bystander noise' })
    ).rejects.toMatchObject({ code: 'NOT_A_PARTY' });
  });

  it('refuses evidence on a resolved dispute', async () => {
    const escrow = await makeEscrow();
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Resolved while appending',
      evidenceJson: {},
    });
    const settled = await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'buyer',
      resolutionNotes: 'test resolution',
      source: 'panel',
    });
    expect(settled.resolvedAt).not.toBeNull();

    await expect(
      sulhaService.appendEvidence(dispute.id, PASSPORT_A, { notes: 'late evidence' })
    ).rejects.toMatchObject({ code: 'DISPUTE_ALREADY_RESOLVED' });
  });
});

describe('settleDispute', () => {
  it('resolves for the seller, unfreezes the escrow to released, and closes the session', async () => {
    const escrow = await makeEscrow({ status: 'in_progress' });
    const session = await engineService.openSession('user', 'sulha-test-owner', 800);
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Seller delivered late',
      evidenceJson: {},
      sessionId: session.sessionId,
    });

    const settled = await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'seller',
      resolutionNotes: 'Delivery proof checks out',
      source: 'ai',
      confidence: 96,
    });

    expect(settled.status).toBe('resolved_seller');
    expect(settled.aiConfidence).toBe(96);
    expect(settled.resolutionNotes).toBe('Delivery proof checks out');

    const escrowAfter = await prisma.universalEscrow.findUnique({ where: { referenceId: escrow.referenceId } });
    expect(escrowAfter?.status).toBe('released');

    const sessionAfter = await prisma.pabandiSession.findUnique({ where: { id: session.sessionId } });
    expect(sessionAfter?.status).not.toBe('active');
  });

  it('resolves for the buyer and refunds the escrow (disputed -> refunded is a legal move)', async () => {
    const escrow = await makeEscrow({ status: 'funded' });
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_B,
      reason: 'Buyer never received the booking',
      evidenceJson: {},
    });

    const settled = await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'buyer',
      resolutionNotes: 'No proof of delivery on file',
      source: 'panel',
    });

    expect(settled.status).toBe('resolved_buyer');
    const escrowAfter = await prisma.universalEscrow.findUnique({ where: { referenceId: escrow.referenceId } });
    expect(escrowAfter?.status).toBe('refunded');
  });

  it('refuses to settle an already-settled dispute', async () => {
    const escrow = await makeEscrow();
    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Double-settle guard',
      evidenceJson: {},
    });
    await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'seller',
      resolutionNotes: 'Settled once',
      source: 'panel',
    });

    await expect(
      sulhaService.settleDispute({
        disputeId: dispute.id,
        verdict: 'buyer',
        resolutionNotes: 'Settled twice',
        source: 'panel',
      })
    ).rejects.toMatchObject({ code: 'DISPUTE_ALREADY_RESOLVED' });
  });
});

describe('engine freeze (open dispute blocks closeSession)', () => {
  it('blocks closeSession while the dispute is open and unblocks after resolution', async () => {
    const escrow = await makeEscrow({ status: 'in_progress' });
    const session = await engineService.openSession('user', 'sulha-test-owner', 800);

    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Session freeze test',
      evidenceJson: {},
      sessionId: session.sessionId,
    });

    const blocked = await engineService.closeSession(session.sessionId, true);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe('SESSION_DISPUTED');
      expect(blocked.error.disputeId).toBe(dispute.id);
    }

    await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'seller',
      resolutionNotes: 'Unblocking',
      source: 'panel',
    });

    const unblocked = await engineService.closeSession(session.sessionId, true);
    expect(unblocked.ok).toBe(true);
  });

  it('never affects sessions with no dispute', async () => {
    const session = await engineService.openSession('user', 'sulha-test-owner', 800);
    const clean = await engineService.closeSession(session.sessionId, true);
    expect(clean.ok).toBe(true);
  });
});

describe('helpers', () => {
  it('isEscrowFrozen reads the freeze state', async () => {
    const escrow = await makeEscrow();
    expect(await import('../src/services/sulha.service').then((m) => m.isEscrowFrozen(escrow.referenceId))).toBe(false);

    const dispute = await sulhaService.raiseDispute({
      escrowId: escrow.referenceId,
      raisedByPassport: PASSPORT_A,
      reason: 'Frozen read test',
      evidenceJson: {},
    });
    expect(await import('../src/services/sulha.service').then((m) => m.isEscrowFrozen(escrow.referenceId))).toBe(true);

    await sulhaService.settleDispute({
      disputeId: dispute.id,
      verdict: 'seller',
      resolutionNotes: 'Unfreeze',
      source: 'panel',
    });
    expect(await import('../src/services/sulha.service').then((m) => m.isEscrowFrozen(escrow.referenceId))).toBe(false);
  });

  it('exposes the open-status vocabulary used by the blockers and routes', () => {
    expect(DISPUTE_OPEN_STATUSES).toEqual(['open', 'ai_review', 'human_review']);
  });
});
