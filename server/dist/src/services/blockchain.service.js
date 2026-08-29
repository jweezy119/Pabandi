"use strict";
/**
 * blockchain.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Server-side integration with Pabandi's smart contracts.
 *
 * BSC (EVM) — via ethers.js v6 (install: npm i ethers):
 *   • PABToken.sol      — mint PAB rewards on-chain
 *   • PabandiEscrow.sol — create/release/refund booking deposits
 *   • PabandiSoulbound  — mint soulbound NFT loyalty badges
 *
 * Solana — via @solana/web3.js (already in server deps):
 *   • Badge PDA verification (read-only)
 *
 * All actions gracefully degrade — if contract addresses are not set in .env,
 * the server logs a warning but continues (DB-only mode).
 *
 * To fully activate:
 *   1. npm i ethers           (in /server)
 *   2. Deploy contracts:  cd contracts && npm run deploy:testnet
 *   3. Set env vars:  PAB_TOKEN_ADDRESS, ESCROW_CONTRACT_ADDRESS,
 *                     SOULBOUND_CONTRACT_ADDRESS, MINTER_PRIVATE_KEY
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainService = exports.BlockchainService = exports.BadgeTier = void 0;
const logger_1 = require("../utils/logger");
const blockchain_types_1 = require("../types/blockchain.types");
// Re-export for callers
var blockchain_types_2 = require("../types/blockchain.types");
Object.defineProperty(exports, "BadgeTier", { enumerable: true, get: function () { return blockchain_types_2.BadgeTier; } });
// ── Config ─────────────────────────────────────────────────────────────────
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const BSC_RPC_TESTNET = process.env.BSC_RPC_TESTNET_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const IS_TESTNET = process.env.BLOCKCHAIN_NETWORK === 'bscTestnet';
const PAB_TOKEN_ADDRESS = process.env.PAB_TOKEN_ADDRESS;
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;
const SOULBOUND_ADDRESS = process.env.SOULBOUND_CONTRACT_ADDRESS;
const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || MINTER_PRIVATE_KEY;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
// ── ABIs (minimal) ─────────────────────────────────────────────────────────
const PAB_TOKEN_ABI = [
    'function mintReward(address to, uint256 amount, bytes32 reservationId, string calldata rewardType) external',
    'function balanceOf(address account) external view returns (uint256)',
];
const ESCROW_ABI = [
    'function releaseToBusinesss(bytes32 reservationId) external',
    'function refundCustomer(bytes32 reservationId) external',
    'function forfeitNoShow(bytes32 reservationId) external',
    'function getEscrow(bytes32 reservationId) external view returns (tuple(address customer, address business, address token, uint256 amount, uint64 createdAt, uint8 status, bool exists))',
];
const SOULBOUND_ABI = [
    'function mintBadge(address to, uint8 tier, string calldata pseudonymousId, uint16 reliabilityScore, uint32 totalBookings, string calldata aiTrustProfile) external returns (uint256)',
    'function verifyBadge(address wallet, uint8 minTier) external view returns (bool)',
];
// ── Service Class ──────────────────────────────────────────────────────────
class BlockchainService {
    // Dynamic imports used to avoid hard-dep on ethers at module load time
    async getEthers() {
        try {
            return await Promise.resolve().then(() => __importStar(require('ethers')));
        }
        catch {
            logger_1.logger.warn('[Blockchain] ethers not installed. Run: npm i ethers in /server');
            return null;
        }
    }
    async getSolanaWeb3() {
        try {
            return await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        }
        catch {
            logger_1.logger.warn('[Blockchain] @solana/web3.js not available');
            return null;
        }
    }
    async getProvider() {
        const ethers = await this.getEthers();
        if (!ethers)
            return null;
        const rpc = IS_TESTNET ? BSC_RPC_TESTNET : BSC_RPC;
        return new ethers.JsonRpcProvider(rpc);
    }
    async getSigner() {
        if (!MINTER_PRIVATE_KEY)
            return null;
        const ethers = await this.getEthers();
        if (!ethers)
            return null;
        const provider = await this.getProvider();
        if (!provider)
            return null;
        return new ethers.Wallet(MINTER_PRIVATE_KEY, provider);
    }
    // ── PABToken ───────────────────────────────────────────────────────────────
    async mintPabOnChain(walletAddress, amount, reservationId, rewardType) {
        const ethers = await this.getEthers();
        const signer = await this.getSigner();
        if (!ethers || !signer || !PAB_TOKEN_ADDRESS) {
            logger_1.logger.info(`[Blockchain] Simulated: mint ${amount} PAB → ${walletAddress} (${rewardType})`);
            return { simulated: true };
        }
        try {
            const contract = new ethers.Contract(PAB_TOKEN_ADDRESS, PAB_TOKEN_ABI, signer);
            const amountWei = ethers.parseEther(amount.toString());
            const resIdBytes = ethers.keccak256(ethers.toUtf8Bytes(reservationId));
            const tx = await contract.mintReward(walletAddress, amountWei, resIdBytes, rewardType);
            const receipt = await tx.wait();
            logger_1.logger.info(`[Blockchain] Minted ${amount} PAB → ${walletAddress} tx:${receipt.hash}`);
            return { txHash: receipt.hash, simulated: false };
        }
        catch (err) {
            logger_1.logger.error('[Blockchain] PAB mint failed:', err.message);
            return { simulated: true };
        }
    }
    // ── Escrow ─────────────────────────────────────────────────────────────────
    async escrowAction(reservationId, method) {
        const ethers = await this.getEthers();
        const signer = await this.getSigner();
        const reservationIdHash = ethers
            ? ethers.keccak256(ethers.toUtf8Bytes(reservationId))
            : `0x${reservationId}`;
        if (!ethers || !signer || !ESCROW_ADDRESS) {
            logger_1.logger.info(`[Blockchain] Simulated: ${method}(${reservationId})`);
            return { success: true, reservationIdHash, txHash: 'simulated' };
        }
        try {
            const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
            const tx = await contract[method](reservationIdHash);
            const receipt = await tx.wait();
            logger_1.logger.info(`[Blockchain] ${method} ${reservationId} tx:${receipt.hash}`);
            return { success: true, reservationIdHash, txHash: receipt.hash };
        }
        catch (err) {
            logger_1.logger.error(`[Blockchain] ${method} failed:`, err.message);
            return { success: false, reservationIdHash, error: err.message };
        }
    }
    async releaseEscrow(reservationId) {
        return this.escrowAction(reservationId, 'releaseToBusinesss');
    }
    async refundEscrow(reservationId) {
        return this.escrowAction(reservationId, 'refundCustomer');
    }
    async forfeitEscrow(reservationId) {
        return this.escrowAction(reservationId, 'forfeitNoShow');
    }
    // ── Soulbound NFT ──────────────────────────────────────────────────────────
    async mintBadge(walletAddress, tier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile = "AI profile generation in progress...") {
        const tierName = blockchain_types_1.BADGE_TIER_NAMES[tier];
        const isSolana = !walletAddress.startsWith('0x');
        if (isSolana) {
            const web3 = await this.getSolanaWeb3();
            if (!web3)
                return { success: false, chain: 'solana', tier, tierName, error: '@solana/web3.js missing' };
            try {
                const BADGE_PROGRAM_ID = new web3.PublicKey(process.env.SOLANA_BADGE_PROGRAM_ID || 'BadgPkeyPabandiReliabilityBadge1111111111111');
                const owner = new web3.PublicKey(walletAddress);
                const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('badge'), owner.toBuffer(), Buffer.from([tier])], BADGE_PROGRAM_ID);
                logger_1.logger.info(`[Blockchain] Prepared Solana badge mint for ${walletAddress} PDA: ${pda.toBase58()}`);
                return {
                    success: true,
                    chain: 'solana',
                    tier,
                    tierName,
                    badgePDA: pda.toBase58()
                };
            }
            catch (err) {
                logger_1.logger.error('[Blockchain] Solana Soulbound mint preparation failed:', err.message);
                return { success: false, chain: 'solana', tier, tierName, error: err.message };
            }
        }
        const ethers = await this.getEthers();
        const signer = await this.getSigner();
        if (!ethers || !signer || !SOULBOUND_ADDRESS) {
            logger_1.logger.info(`[Blockchain] Simulated: mint ${tierName} badge → ${walletAddress}`);
            return { success: true, chain: 'simulated', tier, tierName, tokenId: 'simulated' };
        }
        try {
            const contract = new ethers.Contract(SOULBOUND_ADDRESS, SOULBOUND_ABI, signer);
            const tx = await contract.mintBadge(walletAddress, tier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile);
            const receipt = await tx.wait();
            logger_1.logger.info(`[Blockchain] Minted ${tierName} badge → ${walletAddress} tx:${receipt.hash}`);
            return { success: true, chain: 'bsc', tier, tierName, txHash: receipt.hash };
        }
        catch (err) {
            logger_1.logger.error('[Blockchain] Soulbound mint failed:', err.message);
            return { success: false, chain: 'bsc', tier, tierName, error: err.message };
        }
    }
    async verifyBscBadge(walletAddress, minTier) {
        const ethers = await this.getEthers();
        const signer = await this.getSigner();
        if (!ethers || !signer || !SOULBOUND_ADDRESS)
            return false;
        try {
            const contract = new ethers.Contract(SOULBOUND_ADDRESS, SOULBOUND_ABI, signer);
            return await contract.verifyBadge(walletAddress, minTier);
        }
        catch (err) {
            logger_1.logger.warn(`[Blockchain] Badge verification failed: ${err.message}`);
            return false;
        }
    }
    /**
     * Verify Solana badge via PDA account existence check.
     */
    async verifySolanaBadge(walletAddress, minTier) {
        const web3 = await this.getSolanaWeb3();
        if (!web3)
            return { verified: false, highestTier: null };
        try {
            const connection = new web3.Connection(SOLANA_RPC, 'confirmed');
            const owner = new web3.PublicKey(walletAddress);
            for (let tier = blockchain_types_1.BadgeTier.Platinum; tier >= minTier; tier--) {
                const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('badge'), owner.toBuffer(), Buffer.from([tier])], 
                // Placeholder program ID — replace with real program ID after deploy
                new web3.PublicKey('BadgPkeyPabandiReliabilityBadge1111111111111'));
                const account = await connection.getAccountInfo(pda);
                if (account !== null) {
                    return { verified: true, highestTier: tier };
                }
                if (tier === 0)
                    break;
            }
        }
        catch (err) {
            logger_1.logger.warn(`[Blockchain] Solana badge check failed: ${err.message}`);
        }
        return { verified: false, highestTier: null };
    }
    /**
     * Compute tier eligibility and mint if not already minted.
     */
    async checkAndMintEligibleBadge(walletAddress, pseudonymousId, reliabilityScore, totalBookings, showRate, aiTrustProfile) {
        const eligibleTier = (0, blockchain_types_1.computeEligibleTier)(totalBookings, showRate);
        if (eligibleTier === null || !walletAddress)
            return null;
        return this.mintBadge(walletAddress, eligibleTier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile);
    }
    // ── Solana Token Transfers ──────────────────────────────────────────────────
    async executeSolanaTransfer(walletAddress, amount) {
        const web3 = await this.getSolanaWeb3();
        if (!web3)
            return { error: '@solana/web3.js not found' };
        try {
            const splToken = await Promise.resolve().then(() => __importStar(require('@solana/spl-token')));
            const bs58 = (await Promise.resolve().then(() => __importStar(require('bs58')))).default;
            const connection = new web3.Connection(SOLANA_RPC, 'confirmed');
            const mintAddress = new web3.PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS || '');
            const toWallet = new web3.PublicKey(walletAddress);
            const privateKeyStr = process.env.SOLANA_PRIVATE_KEY;
            if (!privateKeyStr) {
                logger_1.logger.warn(`[Blockchain] Simulated Solana transfer of ${amount} PAB to ${walletAddress} (No private key found in .env)`);
                return { txHash: 'simulated_tx_hash_' + Date.now() };
            }
            const secretKey = bs58.decode(privateKeyStr);
            const payer = web3.Keypair.fromSecretKey(secretKey);
            // Get or create Treasury ATA
            const treasuryAta = await splToken.getOrCreateAssociatedTokenAccount(connection, payer, mintAddress, payer.publicKey);
            // Get or create User ATA
            const userAta = await splToken.getOrCreateAssociatedTokenAccount(connection, payer, mintAddress, toWallet);
            // Assuming 9 decimals for PAB
            const transferAmount = amount * (10 ** 9);
            const txSignature = await splToken.transfer(connection, payer, treasuryAta.address, userAta.address, payer.publicKey, transferAmount);
            logger_1.logger.info(`[Blockchain] Solana PAB Transferred: ${amount} to ${walletAddress} (tx: ${txSignature})`);
            return { txHash: txSignature };
        }
        catch (err) {
            logger_1.logger.error(`[Blockchain] Solana PAB Transfer failed: ${err.message}`);
            return { error: err.message };
        }
    }
    // ── Wallet Profiler ────────────────────────────────────────────────────────
    /**
     * Fetches the Solana wallet profile for a given address.
     * In a production environment, this would call Solana RPCs or indexers (like Helius/Shyft)
     * to get accurate balance, NFT holdings, and DeFi history.
     * For the current prototype, it returns a simulated but realistic profile based on the address structure.
     */
    async getSolanaWalletProfile(walletAddress) {
        const web3 = await this.getSolanaWeb3();
        if (!web3)
            return { status: 'unknown', balanceSol: 0, holdsLuxuryNfts: false, estimatedNetWorthUsd: 0 };
        try {
            // Deterministically generate a mock profile based on the first few chars of the address
            const charCodeSum = walletAddress.split('').slice(0, 5).reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const isWhale = charCodeSum % 3 === 0;
            const holdsLuxuryNfts = charCodeSum % 2 === 0;
            let balanceSol = (charCodeSum % 100) + 0.5;
            if (isWhale)
                balanceSol *= 100; // Whales have 100x more SOL
            const estimatedNetWorthUsd = balanceSol * 145 + (holdsLuxuryNfts ? 50000 : 0);
            let profileDescription = "Standard Web3 User.";
            if (isWhale && holdsLuxuryNfts) {
                profileDescription = "High Net Worth Individual. Holds premium NFT collections (e.g. Mad Lads, Tensorians). Huge DeFi volume.";
            }
            else if (isWhale) {
                profileDescription = "DeFi Whale. High liquid SOL balance, frequent large swaps on Jupiter.";
            }
            else if (holdsLuxuryNfts) {
                profileDescription = "NFT Collector. Holds moderately valuable PFPs and art pieces.";
            }
            return {
                walletAddress,
                balanceSol: balanceSol.toFixed(2),
                holdsLuxuryNfts,
                isWhale,
                estimatedNetWorthUsd: estimatedNetWorthUsd.toFixed(2),
                profileDescription
            };
        }
        catch (err) {
            logger_1.logger.error(`[Blockchain] Solana Wallet Profile failed: ${err.message}`);
            return { status: 'error', error: err.message };
        }
    }
    // ── Cryptographic Attestations (EAS Equivalent) ────────────────────────────
    /**
     * Simulates logging a trust event as a cryptographically verifiable attestation on Solana.
     * This provides public proof for naysayers that the trust history is immutable.
     */
    async logTrustAttestationOnSolana(userId, reservationId, action, metadata = {}) {
        const web3 = await this.getSolanaWeb3();
        if (!web3)
            return { error: '@solana/web3.js not found' };
        try {
            const mockMode = process.env.MOCK_BLOCKCHAIN === 'true';
            // In production, this would call a Solana program that implements EAS-like schema registries.
            if (mockMode) {
                const bs58 = (await Promise.resolve().then(() => __importStar(require('bs58')))).default;
                const rawData = JSON.stringify({ userId, reservationId, action, metadata, timestamp: Date.now() });
                const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
                const hash = crypto.createHash('sha256').update(rawData).digest();
                const mockTxSignature = bs58.encode(hash);
                logger_1.logger.info(`[Blockchain][MOCK] Attestation simulated for ${action}. txHash: ${mockTxSignature}`);
                return { txHash: mockTxSignature };
            }
            return { error: 'Production Solana attestation not implemented yet' };
        }
        catch (err) {
            logger_1.logger.error(`[Blockchain] Solana Attestation failed: ${err.message}`);
            return { error: err.message };
        }
    }
}
exports.BlockchainService = BlockchainService;
exports.blockchainService = new BlockchainService();
//# sourceMappingURL=blockchain.service.js.map