import { YieldAdapter } from './types';
import { MockYieldAdapter } from './mock.adapter';
import { SolanaYieldAdapter } from './solana.adapter';

/**
 * Resolve the active yield provider.
 *
 * `YIELD_PROVIDER=mock` (default) -> in-memory 4% APY simulator. Safe for local
 * CI, preview and UI testing with no on-chain dependency.
 *
 * `YIELD_PROVIDER=solana` -> real Solana/web3.js adapter routing USDC into a
 * Kamino/Reflect-style vault on devnet. Requires SOLANA_SECRET_KEY and points
 * at devnet until flipped to mainnet.
 */
export function getYieldAdapter(): YieldAdapter {
  const provider = (process.env.YIELD_PROVIDER || 'mock').toLowerCase();
  if (provider === 'solana') {
    return new SolanaYieldAdapter();
  }
  return new MockYieldAdapter();
}

export { YieldAdapter };
