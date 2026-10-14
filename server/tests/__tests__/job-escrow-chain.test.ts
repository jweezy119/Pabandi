import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The event that has never been emitted.
 *
 * `CrmJob.escrowStatus` is read in three places — the job detail panel,
 * `getClientStage`'s defaulted-escrow branch, and the "escrow held over 30 days"
 * alert — and nothing had ever written it. The three event-bus subscribers that set
 * it are complete, correct and marked durable; nothing emitted those events on that
 * bus. The escrow services emitted all three to `trustCore.emit`, a different system
 * writing passport scores. Two systems, identical event names, two buses, so the
 * emitters looked like they were firing.
 *
 * ── THE CONSTRAINT THAT SHAPES THIS ──────────────────────────────────────────
 *
 * `solanaEscrowService.signInitializeEscrowTx(serializedTxBase64, customerWallet)`
 * signs a transaction the CUSTOMER built. The Anchor program makes `customer` a
 * `Signer` and the `payer` for both the state account and the vault, so funds cannot
 * move without the client's own key. The backend cannot open a Solana escrow on
 * anyone's behalf.
 *
 * That is the right design for non-custodial escrow, and it means a Solana escrow is
 * recorded as CREATED — no money held, no `escrow.funded` published, because that
 * event sets `escrowStatus = 'HELD'` and "held" is precisely the claim that would be
 * false.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmJob: { findFirst: vi.fn() },
    solanaEscrow: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    crmClient: { findUnique: vi.fn() },
  },
}));
vi.mock('../../src/services/event-bus.service', () => ({
  eventBus: { publish: vi.fn(), emit: vi.fn(), on: vi.fn() },
}));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '../../src/utils/database';
import { eventBus } from '../../src/services/event-bus.service';
import {
  openEscrowForJob,
  releaseEscrowForJob,
  disputeEscrowForJob,
  refundEscrowForJob,
  getEscrowForJob,
} from '../../src/services/job-escrow.service';

const SVC = 'svc_1';
const JOB = 'job_1';
const CLIENT = 'cli_1';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.solanaEscrow.create as any).mockResolvedValue({ id: 'esc_1', status: 'FUNDED' });
  (prisma.solanaEscrow.update as any).mockResolvedValue({});
  (prisma.solanaEscrow.findFirst as any).mockResolvedValue({
    id: 'esc_1', status: 'FUNDED', job: { clientId: CLIENT },
  });
  // No wallet → the card rail, which is the majority of real cases.
  (prisma.crmClient.findUnique as any).mockResolvedValue({ passport: { walletAddress: null } });
});

function job(over: Record<string, unknown> = {}) {
  return { id: JOB, clientId: CLIENT, solanaEscrow: null, ...over };
}

const open = (over = {}) =>
  openEscrowForJob(SVC, {
    jobId: JOB, amount: 500, trustScore: 80,
    deadline: new Date(Date.now() + 86_400_000), ...over,
  });

describe('opening escrow', () => {
  it('publishes escrow.funded — the event this codebase has never emitted', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(job());
    await open();

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const evt = (eventBus.publish as any).mock.calls[0][0];
    expect(evt.type).toBe('escrow.funded');
    // jobId is what the subscriber reads to find the job to update.
    expect(evt.jobId).toBe(JOB);
    expect(evt.clientId).toBe(CLIENT);
  });

  it('links the escrow to the job, which is the link that was missing entirely', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(job());
    await open();

    const data = (prisma.solanaEscrow.create as any).mock.calls[0][0].data;
    expect(data.jobId).toBe(JOB);
  });

  it('stores no PDA on the card rail', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(job());
    await open();

    const data = (prisma.solanaEscrow.create as any).mock.calls[0][0].data;
    // There is no on-chain account for a card authorisation. Inventing an address
    // would be a column asserting something untrue about the chain.
    expect(data.escrowPda ?? null).toBeNull();
  });

  it('records a Solana escrow as CREATED and publishes nothing', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(job());
    (prisma.crmClient.findUnique as any).mockResolvedValue({
      passport: { walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
    });

    const result = await open();

    const data = (prisma.solanaEscrow.create as any).mock.calls[0][0].data;
    expect(data.status).toBe('CREATED');
    // escrow.funded sets escrowStatus = HELD. Nothing is held yet, so nothing is
    // published — this is the one claim the product cannot afford to overclaim.
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result.state).toBeNull();
  });

  it('is idempotent — a job has at most one escrow', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(
      job({ solanaEscrow: { id: 'esc_existing', status: 'FUNDED' } }),
    );

    const result = await open();

    // Two escrows against one piece of work would need two PDAs and mean nothing.
    expect(prisma.solanaEscrow.create).not.toHaveBeenCalled();
    expect(result.escrowId).toBe('esc_existing');
  });

  it('404s for a job in another tenant', async () => {
    (prisma.crmJob.findFirst as any).mockResolvedValue(null);
    await expect(open()).rejects.toThrow(/not found/i);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

describe('settling escrow', () => {
  it('release publishes escrow.released with the client, so the score moves', async () => {
    await releaseEscrowForJob(SVC, JOB);

    const evt = (eventBus.publish as any).mock.calls[0][0];
    expect(evt.type).toBe('escrow.released');
    expect(evt.clientId).toBe(CLIENT);
  });

  it('dispute publishes escrow.disputed', async () => {
    await disputeEscrowForJob(SVC, JOB, 'Work not completed');
    expect((eventBus.publish as any).mock.calls[0][0].type).toBe('escrow.disputed');
  });

  it('refund publishes a release carrying the refund flag', async () => {
    await refundEscrowForJob(SVC, JOB);
    const evt = (eventBus.publish as any).mock.calls[0][0];
    expect(evt.type).toBe('escrow.released');
    expect(evt.data.refunded).toBe(true);
  });

  it('refuses to release twice', async () => {
    // Re-releasing would double-pay, and the job's trust consequences would fire twice
    // for one event.
    (prisma.solanaEscrow.findFirst as any).mockResolvedValue({
      id: 'esc_1', status: 'RELEASED', job: { clientId: CLIENT },
    });
    await expect(releaseEscrowForJob(SVC, JOB)).rejects.toThrow(/already/i);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('404s when the job has no escrow at all', async () => {
    (prisma.solanaEscrow.findFirst as any).mockResolvedValue(null);
    await expect(releaseEscrowForJob(SVC, JOB)).rejects.toThrow(/no escrow/i);
  });

  it('scopes the lookup to the tenant', async () => {
    await releaseEscrowForJob(SVC, JOB);
    const where = (prisma.solanaEscrow.findFirst as any).mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain(SVC);
  });
});

describe('what the product is allowed to show', () => {
  it('exposes the CRM state and an amount, and no rail', async () => {
    await getEscrowForJob(SVC, JOB);
    expect((prisma.solanaEscrow.findFirst as any).mock.calls[0][0].select)
      .toEqual({ status: true, amount: true });
    // The rail is decided inside the service and never leaves it. A business opening
    // an escrow is choosing to have the client's money held safely, not choosing a
    // settlement technology on their client's behalf.
  });

  it('maps provider statuses onto the four words the CRM speaks', async () => {
    const cases: Array<[string, string | null]> = [
      ['FUNDED', 'HELD'],
      ['RELEASED', 'RELEASED'],
      ['DISPUTED', 'DISPUTED'],
      ['REFUNDED', 'REFUNDED'],
      ['CREATED', null],
    ];
    for (const [providerStatus, expected] of cases) {
      (prisma.solanaEscrow.findFirst as any).mockResolvedValue({
        status: providerStatus, amount: 100,
      });
      const result = await getEscrowForJob(SVC, JOB);
      expect(result).toEqual({ state: expected, amount: 100 });
    }
  });
});
