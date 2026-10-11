import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Auto-retry orchestration.
 *
 * ─── WHY THESE ARE FAKE-BACKED AND NOT INTEGRATION TESTS ─────────────────────
 * The interesting behaviour here is in the side effects and their ORDER: claim
 * the failure, spend one retry atomically, pick a different rail, move the
 * link, notify. A unit test that mocks Prisma to "return whatever the code
 * wants" proves only that the code calls the mocks it was written against, so
 * this file does the opposite: the fake implements Prisma's DOCUMENTED
 * semantics independently — including the `updateMany` count that
 * compare-and-swap depends on — and the code is written against those.
 *
 * `updateManyCountIsHonoured` at the bottom is the guard that keeps this
 * honest. A fake that always returned `{ count: 1 }` would make every
 * idempotency test pass while testing nothing, and that is exactly the failure
 * mode a mock-based suite has.
 *
 * The real database contract is covered elsewhere; what is under test here is
 * the sequencing, which no amount of reading verifies.
 */

// ── Fake Prisma ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface FakeState {
  reconciliationMatch: Row[];
  invoice: Row[];
  businessPaymentMethod: Row[];
}

let state: FakeState;
let idSeq = 0;

/**
 * Prisma's genuine unique-violation error, not a lookalike.
 *
 * The claim path catches `Prisma.PrismaClientKnownRequestError` with code
 * P2002. A hand-rolled class with a `code` property fails that `instanceof`
 * check and gets rethrown instead — which reads as "the duplicate handler is
 * broken" when in fact the test built the wrong error.
 */
const P2002 = (message = 'Unique constraint failed on the fields: (`paymentRef`)') =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

/**
 * Prisma's filter semantics, as far as this file uses them: equality, plus the
 * `in`, `lt` and `gte` operators. Written out rather than delegated to the code
 * under test, because a matcher that only understood what the service happened
 * to pass would silently return zero rows for everything else and make the
 * whole suite pass by finding nothing.
 */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const actual = row[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;
      if ('in' in op) return Array.isArray(op.in) && op.in.includes(actual);
      if ('lt' in op) return typeof actual === 'number' && actual < Number(op.lt);
      if ('gte' in op) return typeof actual === 'number' && actual >= Number(op.gte);
      if ('gt' in op) return typeof actual === 'number' && actual > Number(op.gt);
      if ('lte' in op) return typeof actual === 'number' && actual <= Number(op.lte);
    }
    return actual === value;
  });
}

function project(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, keep] of Object.entries(select)) if (keep) out[k] = row[k];
  return out;
}

const fakePrisma = {
  reconciliationMatch: {
    create: vi.fn(async ({ data }: { data: Row }) => {
      if (state.reconciliationMatch.some((r) => r.paymentRef === data.paymentRef)) {
        throw P2002();
      }
      // An id is required. Without one every row shares `undefined`, and the
      // subsequent findUnique/updateMany by id all resolve to the FIRST row —
      // which silently merges two separate payment attempts into one counter
      // and makes the retry budget look exhausted after a single failure.
      const row: Row = { retryCount: 0, settlementStatus: 'pending', ...data, id: `m_${++idSeq}` };
      state.reconciliationMatch.push(row);
      return project(row, { id: true });
    }),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = state.reconciliationMatch.find((r) => matches(r, where));
      return row ? { ...row } : null;
    }),
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const rows = state.reconciliationMatch.filter((r) => !where || matches(r, where));
      return rows.map((r) => ({ ...r }));
    }),
    update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
      const row = state.reconciliationMatch.find((r) => matches(r, where));
      if (!row) throw new Error('update: no row matched');
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
        const rows = state.reconciliationMatch.filter((r) => matches(r, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    ),
  },
  invoice: {
    findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const row = state.invoice.find((r) => matches(r, where));
      if (!row) return null;
      if (select?.client) {
        const client = state.businessPaymentMethod.find(() => false); // placeholder, replaced below
        void client;
      }
      return project(row, select);
    }),
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const rows = state.invoice.filter((r) => !where || matches(r, where));
      return rows.map((r) => ({ ...r }));
    }),
    update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
      const row = state.invoice.find((r) => matches(r, where));
      if (!row) throw new Error('invoice.update: no row matched');
      Object.assign(row, data);
      return { ...row };
    }),
  },
  businessPaymentMethod: {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const rows = state.businessPaymentMethod.filter((r) => !where || matches(r, where));
      return rows.map((r) => ({ ...r }));
    }),
  },
};

// Paths here resolve relative to THIS file, not to the module under test —
// `../utils/database` would point at `src/services/utils/database`, which does
// not exist, so the mock would silently not apply and the suite would run
// against whatever database the developer has configured.
vi.mock('../../utils/database', () => ({ prisma: fakePrisma }));

const emailService = {
  sendPaymentRetryLink: vi.fn(
    async (
      _client: unknown,
      _invoice: unknown,
      _business: unknown,
      opts: { previousRail: string; newRail: string; reason?: string },
    ) => ({ ok: true, opts }),
  ),
  sendPaymentDidntArrive: vi.fn(async () => ({ ok: true })),
};
vi.mock('../email.service', () => ({ emailService }));

const createNotification = vi.fn(async () => ({ id: 'n1' }));
vi.mock('../notification.service', () => ({ createNotification }));

const runFailureOwnership = vi.fn(async () => ({
  invoiceId: 'inv_1',
  invoiceNumber: 'INV-0001',
  status: 'sent',
  daysPastDue: 9,
  clientNotified: true,
  businessNotified: true,
  trustEventsFired: [],
  escrowHeld: false,
  escrowStatus: null,
  escalatedToDispute: false,
  disputeId: null,
  notes: ['escalated'],
}));
vi.mock('../failure-ownership.service', () => ({ runFailureOwnership }));

const createSquareInvoiceLink = vi.fn(async () => ({ url: 'https://square.link/p/generated', source: 'square-merchant-link' }));
vi.mock('../invoice.service', () => ({ createSquareInvoiceLink }));

const emit = vi.fn(async (_eventType: string, _payload: Record<string, unknown>) => undefined);
vi.mock('../../trust/trust-core', () => ({ trustCore: { emit }, default: { emit } }));

/**
 * Loaded in `beforeAll`, not at the top of the file.
 *
 * `vi.mock` factories are hoisted above every top-level declaration, so a
 * static import of the module under test would run those factories while
 * `fakePrisma` is still in its temporal dead zone. Top-level `await` is not an
 * option either — this project compiles to CommonJS. Deferring the import is
 * the form that satisfies both constraints.
 */
let handlePaymentFailed: typeof import('../payment-retry.service')['handlePaymentFailed'];
let MAX_RETRIES: number;

beforeAll(async () => {
  ({ handlePaymentFailed } = await import('../payment-retry.service'));
  ({ MAX_RETRIES } = await import('../../config/rail-fallback'));
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const WALLET = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const SQUARE_LINK = 'https://square.link/p/abc123';
const PAYPAL_LINK = 'https://paypal.me/someone';

const CLIENT = {
  id: 'cli_1',
  name: 'Payer',
  email: 'payer@example.com',
  passportId: 'pp_1',
  passport: { paymentScore: 500, walletAddress: null, verified: true },
};

function seedInvoice(overrides: Row = {}): void {
  state.invoice.push({
    id: 'inv_1',
    number: 'INV-0001',
    subtotal: 100,
    status: 'sent',
    clientId: 'cli_1',
    businessId: 'biz_1',
    paymentLink: null,
    client: CLIENT,
    business: {
      id: 'biz_1',
      name: 'A Business',
      ownerId: 'user_1',
      address: '500 Market St, San Francisco, United States',
      currency: 'USD',
    },
    ...overrides,
  });
}

beforeEach(() => {
  idSeq = 0;
  state = {
    reconciliationMatch: [],
    invoice: [],
    businessPaymentMethod: [
      { businessId: 'biz_1', railId: 'square', target: SQUARE_LINK, isDefault: true },
      { businessId: 'biz_1', railId: 'paypal', target: PAYPAL_LINK, isDefault: false },
      { businessId: 'biz_1', railId: 'bank', target: 'IBAN GB29 NWBK 6016 1331 9268 19', isDefault: false },
    ],
  };
  seedInvoice();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('auto-retry orchestration', () => {
  it('retries a declined card on a different rail and moves the payment link', async () => {
    const outcome = await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(outcome.action).toBe('retried');
    if (outcome.action !== 'retried') return;

    expect(outcome.retryCount).toBe(1);
    expect(outcome.fromRail).toBe('square');
    // Square is excluded, so the retry cannot land back on the rail that just
    // failed — that is the whole difference between a retry and a repeat.
    expect(outcome.toRail).not.toBe('square');
    expect(outcome.paymentLink).toBeTruthy();
    expect(state.invoice[0].paymentLink).toBe(outcome.paymentLink);
  });

  it('records the attempt so the rail history survives', async () => {
    await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    const row = state.reconciliationMatch[0];
    expect(row.status).toBe('failed');
    expect(row.rail).toBe('square');
    // originalRail keeps where it started; lastRetryRail is where it went.
    expect(row.originalRail).toBe('square');
    expect(row.lastRetryRail).not.toBe('square');
    expect(row.failureKind).toBe('declined');
    expect(row.retryCount).toBe(1);
    expect(row.invoiceId).toBe('inv_1');
  });

  it('emails the client exactly once, naming both rails', async () => {
    await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(emailService.sendPaymentRetryLink).toHaveBeenCalledTimes(1);
    const args = emailService.sendPaymentRetryLink.mock.calls[0][3];
    expect(args.previousRail).toBe('Square');
    expect(args.newRail).not.toBe('Square');
  });

  it('fires a retry trust event that cannot move a score', async () => {
    await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(emit).toHaveBeenCalledTimes(1);
    const [eventType, payload] = emit.mock.calls[0];
    expect(eventType).toBe('payment.retry_attempted');
    // invoiceId must be explicit. trustCore.emit fabricates one from
    // `invoice.findFirst()` when it is missing, which would file this client's
    // retry against an unrelated invoice.
    expect(payload.invoiceId).toBe('inv_1');
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it('does nothing at all when the same failure is delivered twice', async () => {
    const first = await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });
    expect(first.action).toBe('retried');

    emailService.sendPaymentRetryLink.mockClear();
    emit.mockClear();
    createNotification.mockClear();

    const second = await handlePaymentFailed({
      paymentRef: 'square:pay_1',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(second.action).toBe('duplicate');
    // The point of the whole claim mechanism: one failure, one retry, one
    // email. Processors redeliver, and this is what stops a slow ack from
    // producing two competing payment links.
    expect(state.reconciliationMatch).toHaveLength(1);
    expect(state.reconciliationMatch[0].retryCount).toBe(1);
    expect(emailService.sendPaymentRetryLink).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('counts attempts against the invoice, not against each payment reference', async () => {
    await handlePaymentFailed({ paymentRef: 'square:pay_1', rail: 'square', amount: 100, clientId: 'cli_1', reason: 'card_declined' });
    await handlePaymentFailed({ paymentRef: 'square:pay_2', rail: 'square', amount: 100, clientId: 'cli_1', reason: 'card_declined' });

    expect(state.reconciliationMatch).toHaveLength(2);
    // Each failed payment gets its own row (paymentRef is unique), but the
    // budget is shared across the invoice. Counting per row would reset to 1
    // on every new row and the chain would never be exhausted.
    expect(state.reconciliationMatch.map((r) => r.retryCount)).toEqual([1, 2]);
  });

  // ── Escalation ────────────────────────────────────────────────────────────

  it('escalates to failure ownership once the retry budget is gone', async () => {
    let last = '';
    for (let i = 0; i < MAX_RETRIES; i += 1) {
      const outcome = await handlePaymentFailed({
        paymentRef: `square:pay_${i}`,
        rail: 'square',
        amount: 100,
        clientId: 'cli_1',
        reason: 'card_declined',
      });
      last = outcome.action;
    }
    expect(last).toBe('retried');

    const escalated = await handlePaymentFailed({
      paymentRef: 'square:pay_final',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(escalated.action).toBe('exhausted');
    expect(runFailureOwnership).toHaveBeenCalledWith('inv_1', { notify: true });
    expect(emit).toHaveBeenCalledWith('payment.retry_exhausted', expect.anything());
    // An exhausted invoice must not also get a fresh "try again" email.
    expect(emailService.sendPaymentRetryLink).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it('collects every rail it has already tried when escalating', async () => {
    const outcomes = [];
    for (let i = 0; i <= MAX_RETRIES; i += 1) {
      outcomes.push(
        await handlePaymentFailed({
          paymentRef: `square:pay_${i}`,
          rail: 'square',
          amount: 100,
          clientId: 'cli_1',
          reason: 'card_declined',
        }),
      );
    }

    const last = outcomes[outcomes.length - 1];
    expect(last.action).toBe('exhausted');
    if (last.action !== 'exhausted') return;
    // Derived from the attempt rows plus the rail that just failed, so it
    // cannot drift from what actually happened.
    expect(last.failedRails).toContain('square');
  });

  it('never retries onto the rail that just declined', async () => {
    // The regression this suite exists to catch: the just-failed rail's own
    // row has no invoiceId yet, so it is invisible to a query scoped by
    // invoice. Forgetting it left the exclusion list empty and the retry landed
    // straight back on the rail that had just declined — a silent repeat.
    const outcomes = [];
    for (let i = 0; i <= MAX_RETRIES; i += 1) {
      outcomes.push(
        await handlePaymentFailed({
          paymentRef: `square:pay_${i}`,
          rail: 'square',
          amount: 100,
          clientId: 'cli_1',
          reason: 'card_declined',
        }),
      );
    }

    for (const outcome of outcomes) {
      if (outcome.action === 'retried') expect(outcome.toRail).not.toBe('square');
    }
  });

  // ── Crypto-specific behaviour ─────────────────────────────────────────────

  it('retries a congested Solana payment on Solana, not on a fiat rail', async () => {
    state.businessPaymentMethod.push({ businessId: 'biz_1', railId: 'solana', target: WALLET, isDefault: false });

    const outcome = await handlePaymentFailed({
      paymentRef: 'solana:SIG1',
      rail: 'solana',
      amount: 100,
      clientId: 'cli_1',
      reason: 'Transaction not landed: block height exceeded',
    });

    expect(outcome.action).toBe('retried');
    if (outcome.action !== 'retried') return;

    expect(outcome.sameRailRetry).toBe(true);
    expect(outcome.toRail).toBe('solana');
    expect(outcome.priorityFeeMultiplier).toBeGreaterThan(1);
    expect(outcome.reasoning).toMatch(/priority fee/i);
  });

  it('switches rails for a Solana failure caused by the payer, not the network', async () => {
    state.businessPaymentMethod.push({ businessId: 'biz_1', railId: 'solana', target: WALLET, isDefault: false });

    const outcome = await handlePaymentFailed({
      paymentRef: 'solana:SIG2',
      rail: 'solana',
      amount: 100,
      clientId: 'cli_1',
      reason: 'Insufficient balance for transaction fee',
    });

    expect(outcome.action).toBe('retried');
    if (outcome.action !== 'retried') return;

    // The balance is the same whichever rail looks at it, so staying on Solana
    // would burn a retry that could not have worked.
    expect(outcome.sameRailRetry).toBe(false);
    expect(outcome.toRail).not.toBe('solana');
    expect(outcome.priorityFeeMultiplier).toBeNull();
  });

  it('cannot route a Solana retry to a client with no wallet', async () => {
    state.businessPaymentMethod.push({ businessId: 'biz_1', railId: 'solana', target: WALLET, isDefault: false });
    state.invoice[0].client = { ...CLIENT, passport: { ...CLIENT.passport, walletAddress: null } };

    const outcome = await handlePaymentFailed({
      paymentRef: 'solana:SIG3',
      rail: 'solana',
      amount: 100,
      clientId: 'cli_1',
      reason: 'Insufficient balance',
    });

    expect(outcome.action).toBe('retried');
    if (outcome.action !== 'retried') return;
    // Eligibility still applies on the retry path. This is the case the missing
    // passport load used to break: with no wallet state, Solana was skipped
    // even for a client who had one.
    expect(outcome.toRail).not.toBe('solana');
  });

  it('can route a Solana retry to a client who does have a wallet', async () => {
    state.businessPaymentMethod.push({ businessId: 'biz_1', railId: 'solana', target: WALLET, isDefault: false });
    state.invoice[0].client = { ...CLIENT, passport: { ...CLIENT.passport, walletAddress: WALLET } };
    // Square is the only other rail; excluding it leaves Solana and bank, and
    // Solana is far cheaper.
    const outcome = await handlePaymentFailed({
      paymentRef: 'square:pay_wallet',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(outcome.action).toBe('retried');
    if (outcome.action !== 'retried') return;
    expect(outcome.toRail).toBe('solana');
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  it('will not retry an invoice that is already paid', async () => {
    // A decline can land after a retry succeeded. Retrying here would move a
    // paid invoice's link and email someone to pay a second time.
    state.invoice[0].status = 'paid';

    const outcome = await handlePaymentFailed({
      paymentRef: 'square:pay_late',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(outcome.action).toBe('skipped');
    expect(emailService.sendPaymentRetryLink).not.toHaveBeenCalled();
    // The attempt is still recorded — an unexplained payment failure on a paid
    // invoice is exactly what a human needs to see.
    expect(state.reconciliationMatch).toHaveLength(1);
    expect(state.reconciliationMatch[0].retryCount).toBe(0);
  });

  it('parks a failure it cannot attribute to an invoice rather than guessing', async () => {
    state.invoice = [];
    const outcome = await handlePaymentFailed({
      paymentRef: 'square:pay_orphan',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    expect(outcome.action).toBe('unmatched');
    expect(emailService.sendPaymentRetryLink).not.toHaveBeenCalled();
    expect(state.reconciliationMatch).toHaveLength(1);
  });

  it('does not guess when two invoices match the amount', async () => {
    state.invoice.push({ ...state.invoice[0], id: 'inv_2', number: 'INV-0002' });

    const outcome = await handlePaymentFailed({
      paymentRef: 'square:pay_ambig',
      rail: 'square',
      amount: 100,
      clientId: 'cli_1',
      reason: 'card_declined',
    });

    // The retry path MOVES a live payment link and emails a real person, so an
    // ambiguous match is worse here than in reconciliation — where it would
    // only record a row for a human to finish.
    expect(outcome.action).toBe('unmatched');
  });

  it('rejects an unknown rail before touching the database', async () => {
    const outcome = await handlePaymentFailed({
      paymentRef: 'mystery:1',
      rail: 'bitcoin' as never,
      amount: 100,
    });

    expect(outcome.action).toBe('skipped');
    expect(fakePrisma.reconciliationMatch.create).not.toHaveBeenCalled();
  });

  it('rejects a failure with no payment reference', async () => {
    const outcome = await handlePaymentFailed({ paymentRef: '', rail: 'square', amount: 100 });
    expect(outcome.action).toBe('skipped');
    expect(fakePrisma.reconciliationMatch.create).not.toHaveBeenCalled();
  });
});

// ── The guard that keeps this file honest ───────────────────────────────────

describe('the fake implements Prisma semantics, not the code under test', () => {
  it('updateMany honours its where clause instead of always reporting success', async () => {
    state.reconciliationMatch.push({ id: 'm1', paymentRef: 'square:x', retryCount: 3, rail: 'square' });

    const stale = await fakePrisma.reconciliationMatch.updateMany({
      where: { id: 'm1', retryCount: 0 },
      data: { retryCount: 1 },
    });
    // The compare-and-swap depends on this returning 0 when the row moved on
    // underneath it. A fake that always returned 1 would make every
    // idempotency test above pass while asserting nothing at all.
    expect(stale.count).toBe(0);
    expect(state.reconciliationMatch[0].retryCount).toBe(3);

    const fresh = await fakePrisma.reconciliationMatch.updateMany({
      where: { id: 'm1', retryCount: 3 },
      data: { retryCount: 4 },
    });
    expect(fresh.count).toBe(1);
    expect(state.reconciliationMatch[0].retryCount).toBe(4);
  });

  it('create raises the unique violation the claim path catches', async () => {
    await expect(
      fakePrisma.reconciliationMatch.create({ data: { id: 'a', paymentRef: 'dup', rail: 'square' } }),
    ).resolves.toBeTruthy();
    await expect(
      fakePrisma.reconciliationMatch.create({ data: { id: 'b', paymentRef: 'dup', rail: 'square' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});