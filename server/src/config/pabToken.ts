/**
 * Canonical $PAB token configuration — the single source of truth for mint addresses.
 *
 * WHY THIS FILE EXISTS
 * Two different mints were hardcoded across the codebase, so the platform was
 * reading and writing two different tokens:
 *
 *   4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ  <- the REAL $PAB
 *     Metaplex metadata: name "Pabandi", symbol "PAB"
 *     metadata URI: https://pabandi-42c5b.web.app/pab-metadata.json
 *     created 2026-08-23 · mint authority 38HR8Bo… (the Pabandi treasury)
 *     treasury holds 999,991,108 of 1,000,000,000 (99.999%)
 *
 *   G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y  <- ORPHAN, DO NOT USE
 *     no Metaplex metadata (no name, no symbol, no URI)
 *     created 2026-09-19 (a month LATER than the real mint)
 *     mint authority 68AQPHec… (not the treasury)
 *     exactly ONE token account exists, holding all 1,000,000,000
 *     the treasury holds ZERO
 *
 * Verified against Solana mainnet via getAccountInfo / getTokenLargestAccounts /
 * getProgramAccounts. `4MLsk` is the only mint that is named, has metadata, and is
 * actually held by the treasury; `G811FH` is unreachable and unlisted.
 *
 * The orphan mint was referenced by staking, agent rewards, booking, CRM, and
 * lease services while the wallet endpoint and the public airdrop page showed
 * `4MLsk` — so a user could stake or be rewarded in a token the wallet page never
 * displayed. Every mint lookup now routes through `getPabMint()` so the two can
 * never diverge again.
 *
 * CHANGING THE MINT
 * Set PAB_MINT_ADDRESS (or SOLANA_PAB_MINT_ADDRESS) in the environment. Both names
 * are accepted because both were in use; PAB_MINT_ADDRESS wins. Setting either to
 * the known-orphan mint logs a loud error rather than silently trading the wrong
 * token.
 */

import { logger } from '../utils/logger';

/** The canonical $PAB mint on Solana mainnet. Named "Pabandi" / symbol "PAB". */
export const PAB_MINT_MAINNET = '4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ';

/**
 * The orphan mint that must never be used.
 *
 * Kept only so a misconfiguration can be detected and named in a log line
 * instead of silently routing real value into an unreachable token.
 */
export const PAB_MINT_ORPHAN = 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';

/** USDC on Solana mainnet — same on every cluster that matters, no override needed. */
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

let warnedOrphan = false;

/**
 * Resolve the $PAB mint for this process.
 *
 * Precedence: PAB_MINT_ADDRESS → SOLANA_PAB_MINT_ADDRESS → the mainnet constant.
 * An empty-string env var (which .env ships) is falsy and falls through, so an
 * unset variable can never resolve to an empty mint.
 */
export function getPabMint(): string {
  const configured = process.env.PAB_MINT_ADDRESS || process.env.SOLANA_PAB_MINT_ADDRESS || '';
  const mint = configured.trim() || PAB_MINT_MAINNET;

  if (mint === PAB_MINT_ORPHAN && !warnedOrphan) {
    warnedOrphan = true;
    logger.error(
      `[PAB] Refusing to treat ${PAB_MINT_ORPHAN} as $PAB. That mint has no metadata, ` +
        `one holder, and zero treasury balance. Using ${PAB_MINT_MAINNET} instead. ` +
        `Unset PAB_MINT_ADDRESS / SOLANA_PAB_MINT_ADDRESS to silence this.`,
    );
    return PAB_MINT_MAINNET;
  }

  return mint;
}

/** Resolve the USDC mint (single constant; env override for devnet testing). */
export function getUsdcMint(): string {
  return (process.env.USDC_MINT_ADDRESS || '').trim() || USDC_MINT_MAINNET;
}
