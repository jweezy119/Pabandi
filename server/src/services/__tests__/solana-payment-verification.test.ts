import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import bs58 from 'bs58';

import {
  extractTransfers,
  verifySolanaPayment,
  resetVerificationConnection,
  type ObservedTransfer,
} from '../solana-payment-verification.service';
import { USDC_MINT_MAINNET } from '../solanaEscrow/constants';

/**
 * Solana payment verification.
 *
 * ─── WHAT IS ACTUALLY UNDER TEST ────────────────────────────────────────────
 * The endpoint this protects used to check that a signature was 64-to-90
 * base58 characters. These tests exist because that is not the same question as
 * "did this money arrive", and the difference was worth an unauthenticated
 * "mark this invoice paid" route.
 *
 * The RPC is stubbed rather than hit: the tests are about our interpretation of
 * what comes back, and a test that depends on a live cluster is a test that
 * fails for reasons unrelated to the code.
 */

const DESTINATION = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const OTHER = '3n1mGZmpaAiVNhFZgLbTHVWXmLpQAdSVvSpvsKrBqJC';
/**
 * A real 64-byte signature, base58-encoded to 88 characters.
 *
 * Had to be generated rather than typed: a plausible-looking string of the
 * right length is not a signature, and the stub decoder checks the byte count
 * exactly as the real one does.
 */
const SIGNATURE = bs58.encode(Buffer.alloc(64, 7));

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A well-formed transfer of 150 USDC. */
function transferInstruction(opts: { mint?: string; amount: string; destination: string; source?: string }) {
  return {
    program: 'spl-token',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    parsed: {
      type: 'transfer',
      info: {
        source: opts.source ?? OTHER,
        destination: opts.destination,
        authority: opts.source ?? OTHER,
        amount: opts.amount,
        mint: opts.mint ?? USDC_MINT_MAINNET,
      },
    },
  };
}

function tx(overrides: Partial<ParsedTransactionWithMeta> = {}): ParsedTransactionWithMeta {
  return {
    slot: 250_000_000,
    transaction: { message: { instructions: [] } },
    meta: { err: null, innerInstructions: [] },
    ...overrides,
  } as unknown as ParsedTransactionWithMeta;
}

/** `inner` is a flat list of instructions, wrapped into a single group. */
function txWith(ix: unknown[], inner: unknown[] = [], err: unknown = null): ParsedTransactionWithMeta {
  return tx({
    transaction: { message: { instructions: ix } } as never,
    meta: { err, innerInstructions: inner.length ? [{ index: 0, instructions: inner }] : [] } as never,
  });
}

// ── Stub the RPC ─────────────────────────────────────────────────────────────

const getParsedTransaction = vi.fn();

beforeEach(() => {
  process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
  resetVerificationConnection();
  getParsedTransaction.mockReset();

  vi.resetModules();
  vi.doMock('@solana/web3.js', () => ({
    Connection: class {
      getParsedTransaction = getParsedTransaction;
    },
  }));
});

afterEach(() => {
  delete process.env.SOLANA_RPC_URL;
  vi.doUnmock('@solana/web3.js');
});

/** Build the service against the stubbed web3 module. */
async function service() {
  const mod = await import('../solana-payment-verification.service');
  return mod;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('extractTransfers', () => {
  it('reads a direct SPL transfer and converts base units to tokens', () => {
    // USDC has 6 decimals, so 150_000_000 base units is $150. Getting this
    // wrong by a factor of a million would make every amount check meaningless.
    const transfers = extractTransfers(txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })]));
    expect(transfers).toHaveLength(1);
    expect(transfers[0].amountTokens).toBeCloseTo(150, 6);
    expect(transfers[0].destination).toBe(DESTINATION);
  });

  it('reads transfers wrapped in inner instructions', () => {
    // Wrapped SPL transfers appear only in innerInstructions once executed.
    // Reading just the outer list misses them, which is a large fraction of
    // real transfers and would make legitimate payments unverifiable.
    const transfers = extractTransfers(
      txWith([{ program: 'spl-token', parsed: { type: 'initializeAccount3', info: {} } }], [
        transferInstruction({ amount: '42000000', destination: DESTINATION }),
      ]),
    );
    expect(transfers).toHaveLength(1);
    expect(transfers[0].amountTokens).toBeCloseTo(42, 6);
  });

  it('ignores SOL moves, which are not invoice settlement', () => {
    const transfers = extractTransfers(
      txWith([{ program: 'system', parsed: { type: 'transfer', info: { lamports: '1000000' } } }]),
    );
    expect(transfers).toHaveLength(0);
  });

  it('ignores tokens we do not accept as settlement', () => {
    const transfers = extractTransfers(
      txWith([transferInstruction({ mint: 'So11111111111111111111111111111111111111112', amount: '5000', destination: DESTINATION })]),
    );
    expect(transfers).toHaveLength(0);
  });

  it('ignores malformed and zero-amount transfers', () => {
    const transfers = extractTransfers(
      txWith([
        transferInstruction({ amount: 'not-a-number', destination: DESTINATION }),
        transferInstruction({ amount: '0', destination: DESTINATION }),
      ]),
    );
    expect(transfers).toHaveLength(0);
  });

  it('survives a transaction with no metadata at all', () => {
    // A not-yet-confirmed transaction can arrive with meta undefined. Throwing
    // here would turn an unverified payment into a 500 and a retry storm.
    expect(() => extractTransfers(tx({ meta: undefined } as never))).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('verifySolanaPayment', () => {
  it('accepts a real, successful transfer of the claimed amount', async () => {
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150, expectedRecipient: DESTINATION });
    expect(result.ok).toBe(true);
  });

  it('rejects a well-formed signature that is not on the chain', async () => {
    // THE regression. The old check accepted any 64-90 character base58 string,
    // so this exact request settled the invoice.
    getParsedTransaction.mockResolvedValue(null);
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no such transaction/);
  });

  it('rejects a transaction that failed on chain', async () => {
    // A real signature, a real transaction, and no money moved. Existence is
    // not settlement.
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })], [], { InstructionError: [0, 'Custom'] }),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/failed on chain/);
  });

  it('rejects a transfer of a different amount than the caller claims', async () => {
    // The amount is the attacker-controlled field. Checking it against the
    // chain is the only thing that makes the body trustworthy.
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '100000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150, expectedRecipient: DESTINATION });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/claimed amount/);
  });

  it('rejects a real payment that went to somebody else', async () => {
    // A genuine, successful, correctly-priced transfer — to the wrong place.
    // Passing existence and amount checks while settling an invoice it did not
    // pay for is the failure mode that survives a naive fix.
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: OTHER })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150, expectedRecipient: DESTINATION });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/expected recipient/);
  });

  it('rejects a transaction with no token transfer in it', async () => {
    getParsedTransaction.mockResolvedValue(txWith([{ program: 'system', parsed: { type: 'transfer', info: {} } }]));
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no accepted token transfer/);
  });

  it('rejects a base58 string that is not 64 bytes', async () => {
    // The old regex accepted anything from 64 to 90 characters — including
    // lengths that decode to neither a 32-byte key nor a 64-byte signature.
    getParsedTransaction.mockResolvedValue(null);
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: 'tooshort', claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not a valid Solana transaction signature/);
    expect(getParsedTransaction).not.toHaveBeenCalled();
  });

  it('rejects a correctly-sized public key used as a signature', async () => {
    // 32 bytes, valid base58, and not a transaction signature. Distinguishing
    // the two is the check the old regex could not make.
    getParsedTransaction.mockResolvedValue(null);
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: bs58.encode(Buffer.alloc(32, 1)), claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not a valid Solana transaction signature/);
  });

  it('fails closed when no RPC is configured', async () => {
    // "We could not check" must not read as "checked and fine". On an endpoint
    // that moves money, silence is the dangerous answer.
    delete process.env.SOLANA_RPC_URL;
    resetVerificationConnection();
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not configured/);
  });

  it('fails closed when the cluster is unreachable', async () => {
    getParsedTransaction.mockRejectedValue(new Error('ECONNREFUSED'));
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/could not fetch/);
  });

  it('accepts a transaction with no claimed amount, since the caller may not know it', async () => {
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: null });
    expect(result.ok).toBe(true);
  });

  it('tolerates one percent of rounding, matching the reconciliation matcher', async () => {
    // Stricter here than at matching time would reject payments reconciliation
    // would accept, which is the wrong direction for a check whose job is to
    // reject forgeries.
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '151000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, claimedAmount: 150, expectedRecipient: DESTINATION });
    expect(result.ok).toBe(true);
  });

  it('returns the observed transfers so the caller can judge the destination', async () => {
    getParsedTransaction.mockResolvedValue(
      txWith([transferInstruction({ amount: '150000000', destination: DESTINATION })]),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const transfers: ObservedTransfer[] = result.transfers;
    expect(transfers[0].destination).toBe(DESTINATION);
  });

  // ── Failure reports ───────────────────────────────────────────────────────

  it('accepts a FAILED transaction when verifying a payment.failed report', async () => {
    // A real decline has `meta.err` set — that is what a decline IS. Checking
    // failure reports against the settlement rules would reject every genuine
    // one, and the retry would never fire. This is the subtle inversion:
    // strict for a claim, lenient for a failure, both requiring existence.
    getParsedTransaction.mockResolvedValue(
      txWith([], [], { InstructionError: [0, 'Custom'] }),
    );
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, requireSuccess: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Nothing moved, and the caller is told so rather than handed an empty set
    // it might mistake for "no destination found".
    expect(result.transfers).toEqual([]);
  });

  it('still rejects a forged failure report for a transaction that does not exist', async () => {
    // A fake failure is not harmless. Every one spends one of the client's
    // retries, so an attacker able to invent them can exhaust the budget before
    // the real payment is ever given a second chance.
    getParsedTransaction.mockResolvedValue(null);
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: SIGNATURE, requireSuccess: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no such transaction/);
  });

  it('still rejects a malformed signature on the failure path', async () => {
    getParsedTransaction.mockResolvedValue(null);
    const { verifySolanaPayment: verify } = await service();

    const result = await verify({ signature: 'nope', requireSuccess: false });
    expect(result.ok).toBe(false);
  });
});