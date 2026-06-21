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

import { logger } from '../utils/logger';
import {
  BadgeTier,
  BADGE_TIER_NAMES,
  computeEligibleTier,
  MintBadgeResult,
  EscrowResult,
} from '../types/blockchain.types';

// Re-export for callers
export { BadgeTier } from '../types/blockchain.types';

// ── Config ─────────────────────────────────────────────────────────────────

const BSC_RPC          = process.env.BSC_RPC_URL         || 'https://bsc-dataseed.binance.org/';
const BSC_RPC_TESTNET  = process.env.BSC_RPC_TESTNET_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const IS_TESTNET       = process.env.BLOCKCHAIN_NETWORK  === 'bscTestnet';

const PAB_TOKEN_ADDRESS   = process.env.PAB_TOKEN_ADDRESS;
const ESCROW_ADDRESS      = process.env.ESCROW_CONTRACT_ADDRESS;
const SOULBOUND_ADDRESS   = process.env.SOULBOUND_CONTRACT_ADDRESS;
const MINTER_PRIVATE_KEY  = process.env.MINTER_PRIVATE_KEY;
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

export class BlockchainService {
  // Dynamic imports used to avoid hard-dep on ethers at module load time
  private async getEthers() {
    try {
      return await import('ethers');
    } catch {
      logger.warn('[Blockchain] ethers not installed. Run: npm i ethers in /server');
      return null;
    }
  }

  private async getSolanaWeb3() {
    try {
      return await import('@solana/web3.js');
    } catch {
      logger.warn('[Blockchain] @solana/web3.js not available');
      return null;
    }
  }

  private async getProvider() {
    const ethers = await this.getEthers();
    if (!ethers) return null;
    const rpc = IS_TESTNET ? BSC_RPC_TESTNET : BSC_RPC;
    return new ethers.JsonRpcProvider(rpc);
  }

  private async getSigner() {
    if (!MINTER_PRIVATE_KEY) return null;
    const ethers = await this.getEthers();
    if (!ethers) return null;
    const provider = await this.getProvider();
    if (!provider) return null;
    return new ethers.Wallet(MINTER_PRIVATE_KEY, provider);
  }

  // ── PABToken ───────────────────────────────────────────────────────────────

  async mintPabOnChain(
    walletAddress: string,
    amount: number,
    reservationId: string,
    rewardType: string
  ): Promise<{ txHash?: string; simulated: boolean }> {
    const ethers = await this.getEthers();
    const signer = await this.getSigner();

    if (!ethers || !signer || !PAB_TOKEN_ADDRESS) {
      logger.info(`[Blockchain] Simulated: mint ${amount} PAB → ${walletAddress} (${rewardType})`);
      return { simulated: true };
    }

    try {
      const contract = new ethers.Contract(PAB_TOKEN_ADDRESS, PAB_TOKEN_ABI, signer);
      const amountWei = ethers.parseEther(amount.toString());
      const resIdBytes = ethers.keccak256(ethers.toUtf8Bytes(reservationId));
      const tx = await contract.mintReward(walletAddress, amountWei, resIdBytes, rewardType);
      const receipt = await tx.wait();
      logger.info(`[Blockchain] Minted ${amount} PAB → ${walletAddress} tx:${receipt.hash}`);
      return { txHash: receipt.hash, simulated: false };
    } catch (err: any) {
      logger.error('[Blockchain] PAB mint failed:', err.message);
      return { simulated: true };
    }
  }

  // ── Escrow ─────────────────────────────────────────────────────────────────

  private async escrowAction(
    reservationId: string,
    method: 'releaseToBusinesss' | 'refundCustomer' | 'forfeitNoShow'
  ): Promise<EscrowResult> {
    const ethers = await this.getEthers();
    const signer = await this.getSigner();
    const reservationIdHash = ethers
      ? ethers.keccak256(ethers.toUtf8Bytes(reservationId))
      : `0x${reservationId}`;

    if (!ethers || !signer || !ESCROW_ADDRESS) {
      logger.info(`[Blockchain] Simulated: ${method}(${reservationId})`);
      return { success: true, reservationIdHash, txHash: 'simulated' };
    }

    try {
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await contract[method](reservationIdHash);
      const receipt = await tx.wait();
      logger.info(`[Blockchain] ${method} ${reservationId} tx:${receipt.hash}`);
      return { success: true, reservationIdHash, txHash: receipt.hash };
    } catch (err: any) {
      logger.error(`[Blockchain] ${method} failed:`, err.message);
      return { success: false, reservationIdHash, error: err.message };
    }
  }

  async releaseEscrow(reservationId: string): Promise<EscrowResult> {
    return this.escrowAction(reservationId, 'releaseToBusinesss');
  }

  async refundEscrow(reservationId: string): Promise<EscrowResult> {
    return this.escrowAction(reservationId, 'refundCustomer');
  }

  async forfeitEscrow(reservationId: string): Promise<EscrowResult> {
    return this.escrowAction(reservationId, 'forfeitNoShow');
  }

  // ── Soulbound NFT ──────────────────────────────────────────────────────────

  async mintBadge(
    walletAddress: string,
    tier: BadgeTier,
    pseudonymousId: string,
    reliabilityScore: number,
    totalBookings: number,
    aiTrustProfile: string = "AI profile generation in progress..."
  ): Promise<MintBadgeResult> {
    const tierName = BADGE_TIER_NAMES[tier];
    const isSolana = !walletAddress.startsWith('0x');

    if (isSolana) {
      const web3 = await this.getSolanaWeb3();
      if (!web3) return { success: false, chain: 'solana', tier, tierName, error: '@solana/web3.js missing' };
      try {
        const BADGE_PROGRAM_ID = new web3.PublicKey(
          process.env.SOLANA_BADGE_PROGRAM_ID || 'BadgPkeyPabandiReliabilityBadge1111111111111'
        );
        const owner = new web3.PublicKey(walletAddress);
        const [pda] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from('badge'), owner.toBuffer(), Buffer.from([tier])],
          BADGE_PROGRAM_ID
        );

        logger.info(`[Blockchain] Prepared Solana badge mint for ${walletAddress} PDA: ${pda.toBase58()}`);
        return { 
          success: true, 
          chain: 'solana', 
          tier, 
          tierName, 
          badgePDA: pda.toBase58()
        };
      } catch (err: any) {
         logger.error('[Blockchain] Solana Soulbound mint preparation failed:', err.message);
         return { success: false, chain: 'solana', tier, tierName, error: err.message };
      }
    }

    const ethers = await this.getEthers();
    const signer = await this.getSigner();

    if (!ethers || !signer || !SOULBOUND_ADDRESS) {
      logger.info(`[Blockchain] Simulated: mint ${tierName} badge → ${walletAddress}`);
      return { success: true, chain: 'simulated', tier, tierName, tokenId: 'simulated' };
    }

    try {
      const contract = new ethers.Contract(SOULBOUND_ADDRESS, SOULBOUND_ABI, signer);
      const tx = await contract.mintBadge(
        walletAddress, tier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile
      );
      const receipt = await tx.wait();
      logger.info(`[Blockchain] Minted ${tierName} badge → ${walletAddress} tx:${receipt.hash}`);
      return { success: true, chain: 'bsc', tier, tierName, txHash: receipt.hash };
    } catch (err: any) {
      logger.error('[Blockchain] Soulbound mint failed:', err.message);
      return { success: false, chain: 'bsc', tier, tierName, error: err.message };
    }
  }

  async verifyBscBadge(walletAddress: string, minTier: BadgeTier): Promise<boolean> {
    const ethers = await this.getEthers();
    const signer = await this.getSigner();
    if (!ethers || !signer || !SOULBOUND_ADDRESS) return false;
    try {
      const contract = new ethers.Contract(SOULBOUND_ADDRESS, SOULBOUND_ABI, signer);
      return await contract.verifyBadge(walletAddress, minTier);
    } catch (err: any) {
      logger.warn(`[Blockchain] Badge verification failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Verify Solana badge via PDA account existence check.
   */
  async verifySolanaBadge(
    walletAddress: string,
    minTier: BadgeTier
  ): Promise<{ verified: boolean; highestTier: BadgeTier | null }> {
    const web3 = await this.getSolanaWeb3();
    if (!web3) return { verified: false, highestTier: null };

    try {
      const connection = new web3.Connection(SOLANA_RPC, 'confirmed');
      const owner = new web3.PublicKey(walletAddress);

      for (let tier = BadgeTier.Platinum; tier >= minTier; tier--) {
        const [pda] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from('badge'), owner.toBuffer(), Buffer.from([tier])],
          // Placeholder program ID — replace with real program ID after deploy
          new web3.PublicKey('BadgPkeyPabandiReliabilityBadge1111111111111')
        );
        const account = await connection.getAccountInfo(pda);
        if (account !== null) {
          return { verified: true, highestTier: tier };
        }
        if (tier === 0) break;
      }
    } catch (err: any) {
      logger.warn(`[Blockchain] Solana badge check failed: ${err.message}`);
    }
    return { verified: false, highestTier: null };
  }

  /**
   * Compute tier eligibility and mint if not already minted.
   */
  async checkAndMintEligibleBadge(
    walletAddress: string | null,
    pseudonymousId: string,
    reliabilityScore: number,
    totalBookings: number,
    showRate: number,
    aiTrustProfile: string
  ): Promise<MintBadgeResult | null> {
    const eligibleTier = computeEligibleTier(totalBookings, showRate);
    if (eligibleTier === null || !walletAddress) return null;
    return this.mintBadge(
      walletAddress, eligibleTier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile
    );
  }

  // ── Solana Token Transfers ──────────────────────────────────────────────────

  async executeSolanaTransfer(walletAddress: string, amount: number): Promise<{ txHash?: string; error?: string }> {
    const web3 = await this.getSolanaWeb3();
    if (!web3) return { error: '@solana/web3.js not found' };
    
    try {
      const splToken = await import('@solana/spl-token');
      const bs58 = (await import('bs58')).default;
      
      const connection = new web3.Connection(SOLANA_RPC, 'confirmed');
      const mintAddress = new web3.PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS || '');
      const toWallet = new web3.PublicKey(walletAddress);
      
      const privateKeyStr = process.env.SOLANA_PRIVATE_KEY;
      if (!privateKeyStr) {
        logger.warn(`[Blockchain] Simulated Solana transfer of ${amount} PAB to ${walletAddress} (No private key found in .env)`);
        return { txHash: 'simulated_tx_hash_' + Date.now() };
      }

      const secretKey = bs58.decode(privateKeyStr);
      const payer = web3.Keypair.fromSecretKey(secretKey);

      // Get or create Treasury ATA
      const treasuryAta = await splToken.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintAddress,
        payer.publicKey
      );

      // Get or create User ATA
      const userAta = await splToken.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintAddress,
        toWallet
      );

      // Assuming 9 decimals for PAB
      const transferAmount = amount * (10 ** 9);

      const txSignature = await splToken.transfer(
        connection,
        payer,
        treasuryAta.address,
        userAta.address,
        payer.publicKey,
        transferAmount
      );

      logger.info(`[Blockchain] Solana PAB Transferred: ${amount} to ${walletAddress} (tx: ${txSignature})`);
      return { txHash: txSignature };
    } catch (err: any) {
      logger.error(`[Blockchain] Solana PAB Transfer failed: ${err.message}`);
      return { error: err.message };
    }
  }
}

export const blockchainService = new BlockchainService();
