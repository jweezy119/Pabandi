import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '../src/utils/database';

/**
 * The Jev arbitrator (commit 2), exercised against the local database with a
 * mocked Jev transport. The model call itself is the one thing mocked — an
 * external API whose availability (and key) is environmental — and the suite
 * pins exactly the branches that matter:
 *
 *   decisive (>90)   → auto-resolution through the real settlement path
 *   inconclusive(≤90) → human_review WITH the preliminary read stored
 *   unavailable      → human_review (fail-safe, never guessed verdicts)
 *   unreadable       → human_review
 *
 * Everything Jev is alleged to cause — the escrow transition, the engine
 * session close, the trust events — runs through the REAL sulha.service and
 * is asserted by reading the rows it wrote.
 */

const decide = vi.fn();

vi.mock('../src/services/jevDecision.service', () => ({
  jevDecision: { decide: (...args: unknown[]) => decide(...(args as [])) },
}));

const { arbitrationService, ARBITRATION_CONFIDENCE_THRESHOLD } = await import('../src/services/arbitration.service');
const { sulhaService } = await import('../src/services/sulha.service');

const PASSPORT_A = 'sulha-arb-passport-buyer';
const PASSPORT_B = 'sulha-arb-passport-seller';

let escrowSeq = 0;

async function makeEscrow(status = 'in_progress'): Promise<string> {
  escrowSeq += 1;
  const referenceId = `sulha-arb-escrow-${escrowSeq}`;
  await prisma.universalEscrow.create({
    data: {
      referenceId,
      template: 'freelance',
      parties: [
        { partyId: PASSPORT_A, role: 'buyer' },
        { partyId: PASSPORT_B, role: 'seller' },
      ] as object,
      amount: 500,
      currency: 'USDC',
      conditions: [{ type: 'delivery', verify: { withinDays: 3 } }] as object,
      status,
    } as never,
  });
  return referenceId;
}

async function raise(escrowId: string, reason = 'Delivery never happened') {
  return sulhaService.raiseDispute({
    escrowId,
    raisedByPassport: PASSPORT_A,
    reason,
    evidenceJson: { urls: [`https://example.test/proof-${escrowId}.jpg`], hashes: ['sha256:deadbeef'] },
  });
}

function verdict(fault: 'buyer' | 'seller', conf: number) {
  return {
    fault: { choice: fault, confidence: conf / 100 },
    confidence: { score: 0.8, confidence: conf / 100 },
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.escrowDispute.deleteMany({ where: { escrowId: { startsWith: 'sulha-arb-escrow' } } });
  await prisma.universalEscrow.deleteMany({ where: { referenceId: { startsWith: 'sulha-arb-escrow' } } });
  await prisma.pabandiSession.deleteMany({ where: { ownerId: 'sulha-arb-owner' } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  decide.mockReset();
});

describe('decisive Jev verdict (> threshold) auto-resolves', () => {
  it('resolves against the seller at 96% and releases the escrow through settlement', async () => {
    const escrowId = await makeEscrow();
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(verdict('seller', 96));

    const result = await arbitrationService.runArbitration(dispute.id);

    expect(result).toMatchObject({ fault: 'seller', confidence: 96 });
    expect((result as { reasoning: string }).reasoning).toContain('seller');

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('resolved_seller');
    expect(after?.aiConfidence).toBe(96);
    expect(after?.resolutionNotes).toContain('Jev auto-resolution');

    const escrowAfter = await prisma.universalEscrow.findUnique({ where: { referenceId: escrowId } });
    expect(escrowAfter?.status).toBe('released');
  });

  it('resolves against the buyer at 92% and refunds the escrow', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(verdict('buyer', 92));

    await arbitrationService.runArbitration(dispute.id);

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('resolved_buyer');
    const escrowAfter = await prisma.universalEscrow.findUnique({ where: { referenceId: escrowId } });
    expect(escrowAfter?.status).toBe('refunded');
  });

  it('does NOT auto-resolve at exactly 90% — the threshold is strict', async () => {
    expect(ARBITRATION_CONFIDENCE_THRESHOLD).toBe(90);
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(verdict('buyer', 90));

    await arbitrationService.runArbitration(dispute.id);

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('human_review');
    expect(after?.aiConfidence).toBe(90);
  });
});

describe('inconclusive or harmed Jev output escalates to the human panel', () => {
  it('a ≤90 verdict escalates WITH the preliminary read visible to the panel', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(verdict('seller', 41));

    await arbitrationService.runArbitration(dispute.id);

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('human_review');
    expect(after?.aiConfidence).toBe(41);
    expect(after?.resolutionNotes).toContain('fault=seller');
    expect(after?.resolutionNotes).toContain('41%');

    const escrowAfter = await prisma.universalEscrow.findUnique({ where: { referenceId: escrowId } });
    // NOT settled by a hedged machine: the escrow stays frozen for humans.
    expect(escrowAfter?.status).toBe('disputed');
  });

  it('Jev unavailable (null) never fabricates a verdict', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(null);

    const result = await arbitrationService.runArbitration(dispute.id);
    expect(result).toEqual({ escalated: 'human_review' });

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('human_review');
    expect(after?.resolutionNotes).toContain('unavailable');
    expect(after?.aiConfidence).toBeNull();
  });

  it('an unreadable fault choice never fabricates a verdict', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue({ fault: { choice: 'neither', confidence: 0.99 } });

    const result = await arbitrationService.runArbitration(dispute.id);
    expect(result).toEqual({ escalated: 'human_review' });

    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('human_review');
    expect(after?.resolutionNotes).toContain('unreadable');
  });
});

describe('queueArbitration (the raise-time entry point)', () => {
  it('flips an open dispute to ai_review synchronously, then the background hearing completes', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(null);
    const queued = await arbitrationService.queueArbitration(dispute.id);
    expect(queued.queued).toBe(true);

    // Synchronous guarantee: the raise response lands on an 'ai_review' row.
    const rightAfterQueue = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(rightAfterQueue?.status).toBe('ai_review');

    // The background hearing then records its own outcome (Jev down → panel).
    await queued.settled;
    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('human_review');
    expect(after?.resolutionNotes).toContain('unavailable');
  });

  it('leaves an already-resolved dispute untouched', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId);
    decide.mockResolvedValue(verdict('seller', 96));
    await arbitrationService.runArbitration(dispute.id); // resolves it
    const callsBeforeQueue = decide.mock.calls.length;

    const queued = await arbitrationService.queueArbitration(dispute.id);
    expect(queued.queued).toBe(false);

    // No re-arbitration of a settled case: even after yielding a tick for a
    // hypothetical background kick-off, the call count is unchanged.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(decide.mock.calls.length).toBe(callsBeforeQueue);
    const after = await prisma.escrowDispute.findUnique({ where: { id: dispute.id } });
    expect(after?.status).toBe('resolved_seller');
  });
});

describe('the hearing contains the contract terms and both evidence stacks', () => {
  it('passes escrow conditions as contract_terms and split evidence in the Jev state', async () => {
    const escrowId = await makeEscrow('funded');
    const dispute = await raise(escrowId, 'Wrong colour delivered');
    decide.mockResolvedValue(null);
    await arbitrationService.runArbitration(dispute.id);

    expect(decide).toHaveBeenCalledTimes(1);
    const [state, questions] = decide.mock.calls[0];
    expect(state).toMatchObject({
      escrow_id: escrowId,
      dispute_id: dispute.id,
      claim: 'Wrong colour delivered',
    });
    expect((state as { contract_terms: { template: string; conditions: unknown[] } }).contract_terms.template).toBe('freelance');
    expect((state as { contract_terms: { conditions: unknown[] } }).contract_terms.conditions).toHaveLength(1);
    expect((state as { buyer_evidence: { urls: string[] } }).buyer_evidence.urls).toContain(
      `https://example.test/proof-${escrowId}.jpg`
    );

    // The charter prompt reaches Jev as instructions — the task-specified
    // arbitrator framing, in question form.
    const fault = (questions as { fault: { instructions: string } }).fault;
    expect(fault.instructions).toContain('You are an objective arbitrator');
    expect(fault.instructions).toContain('Buyer claims: Wrong colour delivered');
  });
});
