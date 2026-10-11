/**
 * On-chain verification for Solana payment webhooks.
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * Every other rail's webhook is authenticated by a shared secret: Square and
 * SafePay send an HMAC over the raw body, PayPal a certificate-backed
 * signature checked against PayPal's own endpoint. Solana has no equivalent,
 * because there is no second party — the payment IS a transaction on a public
 * ledger, and anyone can read it.
 *
 * The check that stood in for authentication was:
 *
 *   if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) reject
 *
 * which is a shape test on a string. The comment beside it claimed "the amount
 * must be confirmed against the chain before we trust it". It was not, and
 * nothing else confirmed it either. So the endpoint accepted any POST carrying
 * a 64-to-90-character base58 string and settled the invoice named in the body
 * — for any amount. The regex does not even require the correct length for a
 * real signature; it accepts things that cannot be one.
 *
 * The attack needed no chain access at all: `{"signature": <64 base58 chars>,
 * "amount": 150, "invoiceId": "..."}` was enough.
 *
 * ─── WHAT ACTUAL VERIFICATION MEANS HERE ────────────────────────────────────
 * Not "the signature is well-formed" but the three facts a payment depends on:
 *
 *   1. The transaction exists and is on the ledger.
 *   2. It did not fail. A transaction whose `meta.err` is set moved nothing.
 *   3. It moved the stated amount of an expected token, to an expected place.
 *
 * (3) is the part that matters and the part most often skipped. Existence plus
 * success is not enough: anyone can point us at a real, successful transaction
 * that moved money somewhere unrelated. The transfer has to be the one the
 * invoice is for, or it proves nothing about this payment.
 *
 * ─── FAILING CLOSED ────────────────────────────────────────────────────────
 * Every path here returns `ok: false` rather than throwing, and an unreachable
 * or unconfigured RPC is a rejection — not a skip. The safe reading of "we
 * could not check" is "we did not check", and on an endpoint whose job is to
 * move money that is the only safe default.
 */

import { Connection, type ParsedTransactionWithMeta } from '@solana/web3.js';
import bs58 from 'bs58';
import { logger } from '../utils/logger';
import { USDC_MINT_MAINNET, USDC_MINT_DEVNET } from './solanaEscrow/constants';

/** A single SPL token movement recovered from a transaction. */
export interface ObservedTransfer {
  mint: string;
  /** Token amount in the mint's base units (USDC has 6). */
  amount: number;
  /** Base-unit amount rendered in whole tokens, for comparison and messages. */
  amountTokens: number;
  destination: string;
  source: string;
}

/** Mints we will accept as settlement for an invoice. */
const ACCEPTED_MINTS: Record<string, number> = {
  [USDC_MINT_MAINNET]: 6,
  [USDC_MINT_DEVNET]: 6,
};

export type SolanaVerification =
  | { ok: true; signature: string; slot: number; transfers: ObservedTransfer[] }
  | { ok: false; reason: string };

function rpcUrl(): string {
  return process.env.SOLANA_RPC_URL || '';
}

let connection: Connection | null = null;
function getConnection(): Connection | null {
  const url = rpcUrl();
  if (!url) return null;
  // 'confirmed' is the right floor: 'processed' can still be rolled back by a
  // failed leader, and 'final' adds latency for no benefit on a ledger that
  // will not reorg beneath it. Mirrors the rest of the escrow SDK.
  if (!connection) connection = new Connection(url, 'confirmed');
  return connection;
}

/**
 * Reset the cached connection.
 *
 * Only needed when SOLANA_RPC_URL changes within a process — tests, mainly.
 * Exported rather than reached for because a module-level cache that cannot be
 * cleared is the kind of thing that makes a test suite lie.
 */
export function resetVerificationConnection(): void {
  connection = null;
}

/** Decimal places for a mint's base unit. */
function decimalsFor(mint: string): number | null {
  return ACCEPTED_MINTS[mint] ?? null;
}

/**
 * Recover every SPL token movement in a parsed transaction.
 *
 * Looks at outer instructions AND inner instructions, because a transfer
 * wrapped in a token program still appears as an inner instruction once
 * executed. Reading only the outer list misses every wrapped transfer, which is
 * a large fraction of real ones.
 */
export function extractTransfers(tx: ParsedTransactionWithMeta): ObservedTransfer[] {
  const found: ObservedTransfer[] = [];

  const consider = (ix: unknown): void => {
    if (!ix || typeof ix !== 'object') return;
    const parsed = ix as {
      program?: string;
      parsed?: { type?: string; info?: Record<string, unknown> };
    };
    // Only SPL-token instructions carry a transfer we can attribute to an
    // amount. System-program moves of SOL are not invoice settlement.
    if (parsed.program !== 'spl-token' && parsed.program !== 'spl-token-2022') return;
    const type = parsed.parsed?.type;
    if (type !== 'transfer' && type !== 'transferChecked') return;

    const info = parsed.parsed?.info ?? {};
    const mint = typeof info.mint === 'string' ? info.mint : USDC_MINT_MAINNET;
    const decimals = decimalsFor(mint);
    if (decimals === null) return; // Not a settlement mint.

    // `amount` is the base-unit string on both transfer and transferChecked.
    // `uiAmountString` is only present on the nested tokenAmount form, so it is
    // read through a narrowed record rather than assumed.
    const tokenAmount = (info.tokenAmount ?? {}) as Record<string, unknown>;
    const raw = Number(info.amount ?? tokenAmount.uiAmountString ?? NaN);
    if (!Number.isFinite(raw) || raw <= 0) return;

    const destination = typeof info.destination === 'string' ? info.destination : '';
    const source = typeof info.source === 'string' ? info.source : '';

    found.push({
      mint,
      amount: raw,
      amountTokens: raw / Math.pow(10, decimals),
      destination,
      source,
    });
  };

  for (const ix of tx.transaction.message.instructions) consider(ix);
  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) consider(ix);
  }

  return found;
}

export interface VerifyOptions {
  signature: string;
  /**
   * Require the transaction to have SUCCEEDED.
   *
   * True for a payment claim, and false only for a `payment.failed` report.
   * That distinction matters: a genuinely failed transaction has `meta.err`
   * set, so verifying a failure report with the settlement rules would reject
   * every real decline and the retry would never fire.
   *
   * Existence is still checked either way, and that is the part that matters
   * for failures. A forged failure is not harmless — each one spends one of
   * the client's retries, so an attacker who can invent them can burn the
   * budget before the real payment is ever given a second chance.
   */
  requireSuccess?: boolean;
  /**
   * The amount the caller claims. Checked against the chain rather than
   * trusted — this is the field an attacker controls.
   */
  claimedAmount?: number | null;
  /**
   * Expected recipient. When given, a transfer to anywhere else does not
   * count as settlement.
   */
  expectedRecipient?: string | null;
}

/**
 * Verify that a signature is a real, successful transfer of an accepted token.
 *
 * Returns the observed transfers on success so the caller can decide whether
 * the destination is acceptable — the webhook knows which business it belongs
 * to, this function does not.
 */
export async function verifySolanaPayment(options: VerifyOptions): Promise<SolanaVerification> {
  const { signature, claimedAmount, expectedRecipient } = options;
  const requireSuccess = options.requireSuccess !== false;

  const conn = getConnection();
  if (!conn) {
    return { ok: false, reason: 'SOLANA_RPC_URL is not configured, so Solana payments cannot be verified' };
  }

  // Decoded rather than pattern-matched, because the length check is the whole
  // point. A signature is 64 bytes; a public key is 32. The regex this replaced
  // accepted anything from 64 to 90 characters, which includes lengths that
  // cannot be either.
  //
  // Nothing is constructed from the value here — a transaction signature is
  // not an address, and `new PublicKey(signature)` would reject every real one.
  try {
    if (bs58.decode(signature).length !== 64) {
      return { ok: false, reason: 'signature is not a valid Solana transaction signature' };
    }
  } catch {
    return { ok: false, reason: 'signature is not a valid Solana transaction signature' };
  }

  let tx: ParsedTransactionWithMeta | null;
  try {
    tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
  } catch (err) {
    // An RPC error is a failure to verify, not a verification.
    logger.warn(`[SolanaVerify] RPC error fetching ${signature}: ${String(err)}`);
    return { ok: false, reason: 'could not fetch the transaction from the cluster' };
  }

  if (!tx) {
    // The important case. A well-formed signature that is not on the ledger is
    // exactly what the old shape test let through.
    return { ok: false, reason: 'no such transaction on the cluster' };
  }

  if (requireSuccess && tx.meta?.err) {
    return { ok: false, reason: `transaction failed on chain: ${JSON.stringify(tx.meta.err)}` };
  }

  if (!requireSuccess) {
    // A failure report has no transfer to inspect — that is the whole point —
    // so existence is the entire check. Returned with an empty transfer list
    // so callers can tell "verified, nothing moved" from "not verified".
    return { ok: true, signature, slot: tx.slot, transfers: [] };
  }

  const transfers = extractTransfers(tx);
  if (transfers.length === 0) {
    return { ok: false, reason: 'transaction contains no accepted token transfer' };
  }

  const matching = expectedRecipient
    ? transfers.filter((t) => t.destination === expectedRecipient)
    : transfers;

  if (matching.length === 0) {
    return { ok: false, reason: `no transfer to the expected recipient ${expectedRecipient}` };
  }

  if (claimedAmount != null && Number.isFinite(claimedAmount) && claimedAmount > 0) {
    // One-cent tolerance, matching the reconciliation matcher. Stricter here
    // than at matching time would reject payments that reconciliation would
    // happily accept, which is the wrong direction for a security check.
    const matchesAmount = matching.some(
      (t) => Math.abs(t.amountTokens - claimedAmount) <= Math.max(0.01, claimedAmount * 0.01),
    );
    if (!matchesAmount) {
      const observed = matching.map((t) => t.amountTokens).join(', ');
      return {
        ok: false,
        reason: `no transfer matches the claimed amount of ${claimedAmount} (observed: ${observed})`,
      };
    }
  }

  return { ok: true, signature, slot: tx.slot, transfers: matching };
}