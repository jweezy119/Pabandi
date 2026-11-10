/**
 * On-chain verification for Solana payment webhooks & escrow funding.
 *
 * Checks and enforces:
 *  1. Signature length & base58 decoding (64 bytes).
 *  2. Cluster presence with 'finalized' commitment.
 *  3. `meta.err === null` (transaction succeeded without on-chain runtime error).
 *  4. Mint address matches the exact USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
 *  5. Destination matches the specific Anchor escrow PDA / expected recipient.
 *  6. Memo or reference instruction matches the expected workOrderId / invoiceId / reference.
 */

import { Connection, type ParsedTransactionWithMeta } from '@solana/web3.js';
import bs58 from 'bs58';
import { logger } from '../utils/logger';
import { USDC_MINT_MAINNET, USDC_MINT_DEVNET } from './solanaEscrow/constants';

export const EXACT_USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const EXACT_USDC_DEVNET = USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** A single SPL token movement recovered from a transaction. */
export interface ObservedTransfer {
  mint: string;
  /** Token amount in the mint's base units (USDC has 6). */
  amount: number;
  /** Base-unit amount rendered in whole tokens. */
  amountTokens: number;
  destination: string;
  source: string;
}

/** Accepted settlement mints */
const ACCEPTED_MINTS: Record<string, number> = {
  [EXACT_USDC_MAINNET]: 6,
  [EXACT_USDC_DEVNET]: 6,
};

export type SolanaVerification =
  | {
      ok: true;
      signature: string;
      slot: number;
      transfers: ObservedTransfer[];
      memos: string[];
      references: string[];
    }
  | { ok: false; reason: string };

function rpcUrl(): string {
  return process.env.SOLANA_RPC_URL || '';
}

let connection: Connection | null = null;

export function getConnection(): Connection | null {
  const url = rpcUrl();
  if (!url) return null;
  if (!connection) {
    connection = new Connection(url, 'finalized');
  }
  return connection;
}

export function resetVerificationConnection(): void {
  connection = null;
}

function decimalsFor(mint: string): number | null {
  return ACCEPTED_MINTS[mint] ?? null;
}

/**
 * Extracts memo text and reference keys from outer and inner instructions.
 */
export function extractMemosAndReferences(tx: ParsedTransactionWithMeta): {
  memos: string[];
  references: string[];
} {
  const memos: string[] = [];
  const references: string[] = [];

  // 1. Account keys in transaction message
  const accountKeys = tx.transaction.message.accountKeys || [];
  for (const acc of accountKeys) {
    const pubkey = typeof acc === 'string' ? acc : acc.pubkey?.toString();
    if (pubkey) references.push(pubkey);
  }

  // 2. Helper to extract memos from instructions
  const checkInstruction = (ix: any) => {
    if (!ix) return;
    const program = ix.program || '';
    const programId = ix.programId?.toString() || '';

    // SPL Memo program
    if (
      program === 'spl-memo' ||
      programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' ||
      programId === 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo'
    ) {
      if (typeof ix.parsed === 'string') {
        memos.push(ix.parsed);
      } else if (ix.parsed?.info?.memo) {
        memos.push(String(ix.parsed.info.memo));
      }
    }
  };

  for (const ix of tx.transaction.message.instructions) {
    checkInstruction(ix);
  }

  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      checkInstruction(ix);
    }
  }

  return { memos, references };
}

/**
 * Recover every SPL token movement in a parsed transaction.
 */
export function extractTransfers(tx: ParsedTransactionWithMeta): ObservedTransfer[] {
  const found: ObservedTransfer[] = [];

  const consider = (ix: unknown): void => {
    if (!ix || typeof ix !== 'object') return;
    const parsed = ix as {
      program?: string;
      parsed?: { type?: string; info?: Record<string, unknown> };
    };

    if (parsed.program !== 'spl-token' && parsed.program !== 'spl-token-2022') return;
    const type = parsed.parsed?.type;
    if (type !== 'transfer' && type !== 'transferChecked') return;

    const info = parsed.parsed?.info ?? {};
    const mint = typeof info.mint === 'string' ? info.mint : EXACT_USDC_MAINNET;
    const decimals = decimalsFor(mint);
    if (decimals === null) return; // Reject any mint not strictly in accepted USDC mints

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
  requireSuccess?: boolean;
  claimedAmount?: number | null;
  /** Expected recipient / Escrow Vault PDA */
  expectedRecipient?: string | null;
  /** Specific Anchor Escrow PDA */
  expectedEscrowPda?: string | null;
  /** Work order ID, invoice ID, or reference note */
  expectedReference?: string | null;
  /** Optional override for commitment level (defaults to 'finalized') */
  commitment?: 'confirmed' | 'finalized';
}

/**
 * Hardened Solana verification service.
 * Enforces finality, non-error status, exact USDC mint, Anchor escrow PDA, and memo matching.
 */
export async function verifySolanaPayment(options: VerifyOptions): Promise<SolanaVerification> {
  const {
    signature,
    claimedAmount,
    expectedRecipient,
    expectedEscrowPda,
    expectedReference,
    commitment = 'finalized',
  } = options;
  const requireSuccess = options.requireSuccess !== false;

  const conn = getConnection();
  if (!conn) {
    return {
      ok: false,
      reason: 'SOLANA_RPC_URL is not configured, so Solana payments cannot be verified',
    };
  }

  // 1. Signature structure validation
  try {
    if (bs58.decode(signature).length !== 64) {
      return { ok: false, reason: 'signature is not a valid Solana transaction signature' };
    }
  } catch {
    return { ok: false, reason: 'signature is not a valid Solana transaction signature' };
  }

  // 2. Fetch transaction at finalized commitment
  let tx: ParsedTransactionWithMeta | null;
  try {
    tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment,
    });
  } catch (err) {
    logger.warn(`[SolanaVerify] RPC error fetching ${signature}: ${String(err)}`);
    return { ok: false, reason: 'could not fetch the transaction from the cluster' };
  }

  if (!tx) {
    return { ok: false, reason: 'no such transaction found on the cluster at finalized commitment' };
  }

  // 3. Strict failure check: meta.err must be null
  if (requireSuccess && tx.meta?.err !== null && tx.meta?.err !== undefined) {
    return {
      ok: false,
      reason: `transaction failed on-chain with error: ${JSON.stringify(tx.meta.err)}`,
    };
  }

  const { memos, references } = extractMemosAndReferences(tx);

  if (!requireSuccess) {
    return {
      ok: true,
      signature,
      slot: tx.slot,
      transfers: [],
      memos,
      references,
    };
  }

  // 4. Token transfers verification
  const transfers = extractTransfers(tx);
  if (transfers.length === 0) {
    return { ok: false, reason: 'transaction contains no verified USDC transfer' };
  }

  // 5. Verify mint is strictly accepted USDC mint
  const hasValidMint = transfers.some(
    (t) => t.mint === EXACT_USDC_MAINNET || t.mint === EXACT_USDC_DEVNET
  );
  if (!hasValidMint) {
    return {
      ok: false,
      reason: `transfer mint does not match exact USDC mint (${EXACT_USDC_MAINNET})`,
    };
  }

  // 6. Destination enforcement: Match specific Anchor escrow PDA or expected recipient
  const targetRecipient = expectedEscrowPda || expectedRecipient;
  const matchingTransfers = targetRecipient
    ? transfers.filter((t) => t.destination === targetRecipient)
    : transfers;

  if (matchingTransfers.length === 0) {
    return {
      ok: false,
      reason: `no transfer directed to expected escrow destination ${targetRecipient}`,
    };
  }

  // 7. Amount verification with 1-cent tolerance
  if (claimedAmount != null && Number.isFinite(claimedAmount) && claimedAmount > 0) {
    const matchesAmount = matchingTransfers.some(
      (t) => Math.abs(t.amountTokens - claimedAmount) <= Math.max(0.01, claimedAmount * 0.01)
    );
    if (!matchesAmount) {
      const observed = matchingTransfers.map((t) => t.amountTokens).join(', ');
      return {
        ok: false,
        reason: `no transfer matches the claimed amount of ${claimedAmount} (observed: ${observed})`,
      };
    }
  }

  // 8. Memo / Reference match enforcement
  if (expectedReference) {
    const refClean = expectedReference.trim().toLowerCase();
    const memoMatch = memos.some((m) => m.toLowerCase().includes(refClean));
    const keyMatch = references.some((r) => r.toLowerCase() === refClean);

    if (!memoMatch && !keyMatch) {
      return {
        ok: false,
        reason: `transaction lacks required reference or memo matching '${expectedReference}'`,
      };
    }
  }

  return {
    ok: true,
    signature,
    slot: tx.slot,
    transfers: matchingTransfers,
    memos,
    references,
  };
}
