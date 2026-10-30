import { PublicKey, Connection } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { logger } from '../utils/logger';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS;

export interface OnChainTarget {
  wallet: string;
  usdcBalance: number;
  txCount: number;
  lastActivity: Date | null;
  source: 'solana-usdc-holder' | 'solana-transactor';
  confidence: number;
}

/**
 * Discover wallets that hold USDC on Solana.
 * These are the highest-intent escrow candidates: they already have the
 * settlement currency and just need a trust layer to transact through.
 */
export async function discoverUSDCWallets(connection: Connection): Promise<OnChainTarget[]> {
  const targets: OnChainTarget[] = [];

  try {
    // Get the 20 largest USDC token accounts by balance
    const largest = await connection.getTokenLargestAccounts(USDC_MINT, 'processed');
    const accounts = largest.value.slice(0, 20);

    for (const acc of accounts) {
      try {
        const accountInfo = await getAccount(connection, new PublicKey(acc.address));
        const owner = accountInfo.owner.toBase58();

        // Skip the platform wallet itself
        if (PLATFORM_WALLET && owner === PLATFORM_WALLET) continue;

        const balance = Number(accountInfo.amount) / 1e6; // USDC has 6 decimals

        targets.push({
          wallet: owner,
          usdcBalance: balance,
          txCount: 0,
          lastActivity: null,
          source: 'solana-usdc-holder',
          confidence: Math.min(100, Math.round((balance / 1000) * 100)), // cap at 100
        });
      } catch {
        // Account may have been closed; skip
      }
    }
  } catch (err) {
    logger.error(`[Scout Web3] USDC holder discovery failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return targets;
}

/**
 * Discover wallets that have recently transacted in USDC.
 * Active transactors are more likely to need escrow than passive holders.
 */
export async function discoverUSDCTransactors(connection: Connection): Promise<OnChainTarget[]> {
  const targets: OnChainTarget[] = [];
  const seen = new Set<string>();

  try {
    // Scan recent signatures involving the USDC mint
    const sigs = await connection.getSignaturesForAddress(USDC_MINT, { limit: 100 });

    for (const sigInfo of sigs) {
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.transaction) continue;

        const message = tx.transaction.message;
        // Handle both legacy and versioned messages
        let accountKeys: PublicKey[] = [];
        if ('accountKeys' in message) {
          accountKeys = message.accountKeys;
        } else if (message.staticAccountKeys) {
          accountKeys = message.staticAccountKeys;
        }

        // Extract unique wallet addresses from the transaction
        for (let i = 0; i < accountKeys.length; i++) {
          const key = accountKeys[i].toBase58();
          if (seen.has(key)) continue;
          if (PLATFORM_WALLET && key === PLATFORM_WALLET) continue;

          seen.add(key);
          targets.push({
            wallet: key,
            usdcBalance: 0,
            txCount: 1,
            lastActivity: new Date(sigInfo.blockTime! * 1000),
            source: 'solana-transactor',
            confidence: 40, // transactor but unknown balance
          });

          if (targets.length >= 20) break;
        }
      } catch {
        // Skip failed transaction fetches
      }

      if (targets.length >= 20) break;
    }
  } catch (err) {
    logger.error(`[Scout Web3] USDC transactor discovery failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return targets;
}

/**
 * Get the USDC balance for a specific wallet.
 */
export async function getWalletUSDCBalance(connection: Connection, wallet: string): Promise<number> {
  try {
    const owner = new PublicKey(wallet);
    const accounts = await connection.getTokenAccountsByOwner(owner, { mint: USDC_MINT });
    if (accounts.value.length === 0) return 0;

    const accountInfo = await getAccount(connection, new PublicKey(accounts.value[0].pubkey));
    return Number(accountInfo.amount) / 1e6;
  } catch {
    return 0;
  }
}

export const scoutWeb3 = { discoverUSDCWallets, discoverUSDCTransactors, getWalletUSDCBalance };
