"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.web3ExplorerBase = exports.web3ContractAddress = exports.web3RequiredEnv = exports.defaultDepositModeWeb3 = exports.isDemoMode = void 0;
const isDemoMode = () => process.env.DEMO_MODE === 'true';
exports.isDemoMode = isDemoMode;
const defaultDepositModeWeb3 = () => (process.env.DEPOSIT_DEFAULT || 'standard').toLowerCase() === 'web3';
exports.defaultDepositModeWeb3 = defaultDepositModeWeb3;
const web3RequiredEnv = () => ({
    chain: process.env.WEB3_CHAIN || 'bsc-testnet',
    rpc: process.env.WEB3_RPC_URL || process.env.BSC_RPC_TESTNET_URL || process.env.BSC_RPC_URL || '',
    privateKey: !!process.env.ESCROW_ORACLE_PRIVATE_KEY,
    contract: !!process.env.ESCROW_CONTRACT_ADDRESS,
    depositDefaultWeb3: (0, exports.defaultDepositModeWeb3)(),
});
exports.web3RequiredEnv = web3RequiredEnv;
const web3ContractAddress = () => process.env.ESCROW_CONTRACT_ADDRESS || '';
exports.web3ContractAddress = web3ContractAddress;
const web3ExplorerBase = () => {
    const chain = (process.env.WEB3_CHAIN || 'bsc-testnet').toLowerCase();
    if (chain.includes('bsc') && chain.includes('main'))
        return 'https://bscscan.com';
    if (chain.includes('bsc'))
        return 'https://testnet.bscscan.com';
    if (chain.includes('sol'))
        return process.env.SOLANA_RPC?.includes('mainnet') ? 'https://solscan.io' : 'https://solscan.io';
    if (chain.includes('base'))
        return 'https://basescan.org';
    if (chain.includes('poly'))
        return 'https://polygonscan.com';
    return 'https://testnet.bscscan.com';
};
exports.web3ExplorerBase = web3ExplorerBase;
//# sourceMappingURL=env.js.map