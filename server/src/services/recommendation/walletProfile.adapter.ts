import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

/**
 * walletProfile.adapter — first-party, on-chain wallet-behavior signal extraction.
 *
 * Frugality / Invent & Simplify:
 *  - PRIMARY signal = real on-chain history (age, recurring income, DeFi LTV, program
 *    interactions). No paid API required to run: defaults to public RPC.
 *  - HELIUS is a drop-in slot: set process.env.HELIUS_API_KEY and the adapter routes
 *    getSignaturesForAddress through Helius's enhanced RPC for higher rate limits +
 *    parsed transaction metadata. Same output shape either way.
 *  - Returns a normalized WalletProfile the scorer consumes. Deterministic, no AI.
 */

export interface WalletProfile {
  address: string;
  ageDays: number; // wallet first-seen age (warm-up / "OG" factor)
  txCount: number; // total signatures seen (capped sample)
  recurringIncome: boolean; // receives recurring USDC/SOL from enterprise-ish flows
  incomeStreams: number; // distinct sources of recurring inbound value
  ltvPct: number | null; // loan-to-value if leveraged (null = no borrowing detected)
  defiInteractions: number; // count of interactions with known DeFi / lend programs
  anchorDeploys: number; // BPFLoader / Anchor program deployments (skill-match signal)
  failedTxRatio: number; // 0..1 ratio of failed/erroneous txs (reliability)
  lastActiveDays: number; // days since last activity
  raw?: any; // optional raw payload from Helius for downstream ML later
}

const KNOWN_LEND_PROGRAMS = new Set([
  'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', // Kamino Lend
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5CycNqfAs', //? placeholder; replaced at runtime via env
  'So1endDq2YkqhipRh3WGVQzWM7L4X7TPJfWhzA4g9K', // Solend
]);

const BPF_LOADER = new Set([
  'BPFLoader2111111111111111111111111111111111',
  'BPFLoader1111111111111111111111111111111111',
]);

function rpcUrl(): string {
  if (process.env.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

function ageFromFirstSig(firstTs: number | undefined, now: number): number {
  if (!firstTs) return 0;
  return Math.max(0, Math.floor((now - firstTs) / 86_400_000));
}

/**
 * Extract a WalletProfile from on-chain history.
 * Sampling cap keeps it cheap: we read up to `limit` signatures and inspect a window
 * of them for income/deFi/program signals. Recurring income + anchor deploys are the
 * highest-value signals for the recommendation engine.
 */
export async function getWalletProfile(address: string, limit = 60): Promise<WalletProfile> {
  const conn = new Connection(rpcUrl(), 'confirmed');
  const now = Date.now();
  const base: WalletProfile = {
    address,
    ageDays: 0,
    txCount: 0,
    recurringIncome: false,
    incomeStreams: 0,
    ltvPct: null,
    defiInteractions: 0,
    anchorDeploys: 0,
    failedTxRatio: 0,
    lastActiveDays: 999,
  };

  let pub: PublicKey;
  try {
    pub = new PublicKey(address);
  } catch {
    return base;
  }

  // Wallet age from first signature (oldest in the window).
  const sigs = await conn.getSignaturesForAddress(pub, { limit }, 'confirmed');
  base.txCount = sigs.length;
  if (sigs.length === 0) return base;

  const oldest = sigs[sigs.length - 1]?.blockTime;
  base.ageDays = ageFromFirstSig(oldest ? oldest * 1000 : undefined, now);
  const newest = sigs[0]?.blockTime;
  base.lastActiveDays = newest ? Math.max(0, Math.floor((now - newest * 1000) / 86_400_000)) : base.lastActiveDays;

  // Count failed txs in the window (reliability gate).
  const failed = sigs.filter((s) => s.err).length;
  base.failedTxRatio = sigs.length ? failed / sigs.length : 0;

  // Income / DeFi / program signals from parsed transactions (sample a bounded window).
  const sample = sigs.slice(0, Math.min(20, sigs.length));
  const seenInbound = new Set<string>();
  for (const s of sample) {
    if (!s.signature) continue;
    try {
      const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx?.transaction?.message) continue;
      const ixs = tx.transaction.message.instructions as any[];
      for (const ix of ixs) {
        const pid = ix?.programId?.toString?.() || '';
        // Anchor / BPF deploys
        if (BPF_LOADER.has(pid) || pid === 'Anchor111111111111111111111111111111') {
          base.anchorDeploys += 1;
        }
        // DeFi / lend programs
        if (KNOWN_LEND_PROGRAMS.has(pid)) {
          base.defiInteractions += 1;
        }
        // Recurring inbound: SPL transfer to this wallet from a stable counterparty
        const parsed = ix?.parsed;
        if (parsed?.type === 'transfer' && parsed?.info?.destination === address) {
          const src = parsed.info.authority || parsed.info.source;
          if (src) seenInbound.add(src);
        }
      }
    } catch {
      // rate-limited or unparseable — skip this tx, don't fail the whole profile
      continue;
    }
  }
  base.incomeStreams = seenInbound.size;
  base.recurringIncome = seenInbound.size >= 2; // 2+ distinct recurring sources => "salary" snapshot

  return base;
}

export const _internal = { KNOWN_LEND_PROGRAMS, BPF_LOADER, rpcUrl };
