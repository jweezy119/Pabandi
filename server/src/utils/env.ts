export const isDemoMode = () => process.env.DEMO_MODE === 'true';

export const defaultDepositModeWeb3 = () =>
  (process.env.DEPOSIT_DEFAULT || 'standard').toLowerCase() === 'web3';

export const web3RequiredEnv = () => ({
  chain: process.env.WEB3_CHAIN || 'bsc-testnet',
  rpc: process.env.WEB3_RPC_URL || process.env.BSC_RPC_TESTNET_URL || process.env.BSC_RPC_URL || '',
  privateKey: !!process.env.ESCROW_ORACLE_PRIVATE_KEY,
  contract: !!process.env.ESCROW_CONTRACT_ADDRESS,
  depositDefaultWeb3: defaultDepositModeWeb3(),
});

export const web3ContractAddress = () =>
  process.env.ESCROW_CONTRACT_ADDRESS || '';

export const web3ExplorerBase = () => {
  const chain = (process.env.WEB3_CHAIN || 'bsc-testnet').toLowerCase();
  if (chain.includes('bsc') && chain.includes('main')) return 'https://bscscan.com';
  if (chain.includes('bsc')) return 'https://testnet.bscscan.com';
  if (chain.includes('sol')) return process.env.SOLANA_RPC?.includes('mainnet') ? 'https://solscan.io' : 'https://solscan.io';
  if (chain.includes('base')) return 'https://basescan.org';
  if (chain.includes('poly')) return 'https://polygonscan.com';
  return 'https://testnet.bscscan.com';
};
