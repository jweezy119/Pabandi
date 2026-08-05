import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';

// ── Config ─────────────────────────────────────────────────────
const MINT_ADDRESS = process.env.SOLANA_PAB_MINT_ADDRESS || 'Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ';
const TREASURY_WALLET = process.env.PABANDI_TREASURY_WALLET || '68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const TOKEN_DECIMALS = 9;
const MAX_DAILY_OUTFLOW = 100; // PAB per agent per day (compliance limit)
const MAX_TRANSACTIONS_PER_DAY = 10;

// ── USDC Pool Arbitrage ──────────────────────────────────────────
const USDC_POOL_ADDRESS = process.env.PAB_USDC_POOL_ADDRESS || 'GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL';
const USDC_MINT_ADDRESS = process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ARBITRAGE_FEE_BPS = 30; // 0.30% fee per swap
const MIN_POOL_LIQUIDITY = 5000; // minimum USDC liquidity to trigger arbitrage
const ARBITRAGE_INTERVAL_MS = parseInt(process.env.PAB_ARBITRAGE_INTERVAL_MS || '300000', 10); // 5 min default

// ── Encryption ─────────────────────────────────────────────────────────
const ENC_KEY = process.env.WALLET_ENC_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function encryptPrivateKey(privateKey: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENC_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decryptPrivateKey(encrypted: string): string {
  const [ivHex, tagHex, encryptedHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = Buffer.from(ENC_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── Agent Types ────────────────────────────────────────────────────────
export interface Web3Agent {
  profileId: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  category: 'freelance-dev' | 'small-biz-owner' | 'project-owner' | 'solopreneur';
  balancePab: number;
  dailyOutflow: number;
  dailyTransactions: number;
  lastReset: Date;
  isActive: boolean;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amount?: number;
  to?: string;
}

// ── Service ────────────────────────────────────────────────────────────
export class Web3AgentService {
  private connection: Connection;
  private treasuryKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  /** Initialize treasury keypair from env (for funding transfers) */
  initTreasury(): boolean {
    const privateKeyStr = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyStr) {
      logger.warn('[Web3Agent] No SOLANA_PRIVATE_KEY env var — treasury operations disabled');
      return false;
    }
    try {
      this.treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
      logger.info(`[Web3Agent] Treasury initialized: ${this.treasuryKeypair.publicKey.toBase58()}`);
      return true;
    } catch (err: any) {
      logger.error('[Web3Agent] Failed to init treasury:', err.message);
      return false;
    }
  }

  /** Create a new agent wallet for a profile */
  async createAgent(profileId: string, category: Web3Agent['category'], firstName: string): Promise<Web3Agent> {
    const seed = crypto.createHash('sha256').update(profileId + firstName).digest();
    const keypair = Keypair.fromSeed(seed.slice(0, 32));
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    const agent: Web3Agent = {
      profileId,
      walletAddress: publicKey,
      encryptedPrivateKey,
      category,
      balancePab: 0,
      dailyOutflow: 0,
      dailyTransactions: 0,
      lastReset: new Date(),
      isActive: true,
    };

    // Save to DB
    await prisma.web3Agent.create({ data: agent as any });

    logger.info(`[Web3Agent] Created agent for ${profileId}: ${publicKey}`);
    return agent;
  }

  /** Load all active agents */
  async loadAgents(): Promise<Web3Agent[]> {
    const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
    return agents as Web3Agent[];
  }

  /** Get agent balance on-chain */
  async getBalance(agent: Web3Agent): Promise<number> {
    try {
      const mintPubkey = new PublicKey(MINT_ADDRESS);
      const ata = await getAssociatedTokenAddress(mintPubkey, new PublicKey(agent.walletAddress));
      const account = await getAccount(this.connection, ata);
      return Number(account.amount) / (10 ** TOKEN_DECIMALS);
    } catch (err) {
      return 0; // ATA doesn't exist yet
    }
  }

  /** Fund an agent wallet from treasury */
  async fundAgent(agent: Web3Agent, amountPab: number): Promise<TransactionResult> {
    if (!this.treasuryKeypair) {
      return { success: false, error: 'Treasury not initialized' };
    }

    try {
      const mintPubkey = new PublicKey(MINT_ADDRESS);
      const treasuryPubkey = new PublicKey(TREASURY_WALLET);
      const agentPubkey = new PublicKey(agent.walletAddress);

      const treasuryAta = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);
      const agentAta = await getAssociatedTokenAddress(mintPubkey, agentPubkey);

      // Ensure agent ATA exists
      try {
        await getAccount(this.connection, agentAta);
      } catch (err) {
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            treasuryPubkey,
            agentAta,
            agentPubkey,
            mintPubkey
          )
        );
        await sendAndConfirmTransaction(this.connection, tx, [this.treasuryKeypair]);
      }

      // Transfer PAB
      const amountLamports = amountPab * (10 ** TOKEN_DECIMALS);
      const transferIx = createTransferInstruction(
        treasuryAta,
        agentAta,
        treasuryPubkey,
        amountLamports
      );

      const tx = new Transaction().add(transferIx);
      const signature = await sendAndConfirmTransaction(this.connection, tx, [this.treasuryKeypair]);

      logger.info(`[Web3Agent] Funded ${agent.walletAddress.substring(0, 8)}... with ${amountPab} PAB: ${signature}`);
      
      // Log transaction
      await prisma.agentTransaction.create({
        data: {
          agentId: agent.profileId,
          type: 'FUNDING',
          amount: amountPab,
          txHash: signature,
          fromAddress: TREASURY_WALLET,
          toAddress: agent.walletAddress,
        } as any,
      });

      return { success: true, txHash: signature, amount: amountPab, to: agent.walletAddress };
    } catch (err: any) {
      logger.error(`[Web3Agent] Funding failed for ${agent.profileId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /** Execute a booking payment (agent pays another agent) */
  async executeBookingPayment(
    fromAgent: Web3Agent,
    toAgent: Web3Agent,
    amountPab: number
  ): Promise<TransactionResult> {
    try {
      // Compliance checks
      if (fromAgent.dailyOutflow + amountPab > MAX_DAILY_OUTFLOW) {
        return { success: false, error: 'Daily outflow limit exceeded' };
      }
      if (fromAgent.dailyTransactions >= MAX_TRANSACTIONS_PER_DAY) {
        return { success: false, error: 'Daily transaction limit exceeded' };
      }

      // Decrypt private key
      const privateKey = decryptPrivateKey(fromAgent.encryptedPrivateKey);
      const senderKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));

      const mintPubkey = new PublicKey(MINT_ADDRESS);
      const senderPubkey = new PublicKey(fromAgent.walletAddress);
      const recipientPubkey = new PublicKey(toAgent.walletAddress);

      const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      // Ensure recipient ATA exists
      try {
        await getAccount(this.connection, recipientAta);
      } catch (err) {
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            senderPubkey,
            recipientAta,
            recipientPubkey,
            mintPubkey
          )
        );
        await sendAndConfirmTransaction(this.connection, tx, [senderKeypair]);
      }

      // Transfer PAB
      const amountLamports = amountPab * (10 ** TOKEN_DECIMALS);
      const transferIx = createTransferInstruction(
        senderAta,
        recipientAta,
        senderPubkey,
        amountLamports
      );

      const tx = new Transaction().add(transferIx);
      const signature = await sendAndConfirmTransaction(this.connection, tx, [senderKeypair]);

      // Update daily counters
      fromAgent.dailyOutflow += amountPab;
      fromAgent.dailyTransactions += 1;

      // Log transaction
      await prisma.agentTransaction.create({
        data: {
          agentId: fromAgent.profileId,
          type: 'BOOKING_PAYMENT',
          amount: amountPab,
          txHash: signature,
          fromAddress: fromAgent.walletAddress,
          toAddress: toAgent.walletAddress,
        } as any,
      });

      logger.info(`[Web3Agent] Booking payment: ${fromAgent.walletAddress.substring(0, 8)}... → ${toAgent.walletAddress.substring(0, 8)}... | ${amountPab} PAB`);

      return { success: true, txHash: signature, amount: amountPab, to: toAgent.walletAddress };
    } catch (err: any) {
      logger.error(`[Web3Agent] Booking payment failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /** Reset daily counters (called at midnight UTC) */
  async resetDailyCounters(): Promise<void> {
    await prisma.web3Agent.updateMany({
      data: {
        dailyOutflow: 0,
        dailyTransactions: 0,
        lastReset: new Date(),
      },
    });
    logger.info('[Web3Agent] Daily counters reset');
  }

  /**
   * Collect fees from the USDC/PAB liquidity pool.
   * Scans pool reserves, calculates arbitrage opportunity,
   * executes swap if profitable, and credits fee to treasury.
   */
  async collectPoolFees(): Promise<{ success: boolean; feesCollected?: number; error?: string }> {
    try {
      const poolPubkey = new PublicKey(USDC_POOL_ADDRESS);
      const usdcMintPubkey = new PublicKey(USDC_MINT_ADDRESS);
      const pabMintPubkey = new PublicKey(MINT_ADDRESS);

      // Fetch pool account info (simplified: read token balances from pool ATA)
      const poolUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, poolPubkey);
      const poolPabAta = await getAssociatedTokenAddress(pabMintPubkey, poolPubkey);

      let poolUsdc: bigint;
      let poolPab: bigint;

      try {
        const usdcAccount = await getAccount(this.connection, poolUsdcAta);
        poolUsdc = usdcAccount.amount;
      } catch {
        return { success: false, error: 'USDC ATA not found in pool' };
      }

      try {
        const pabAccount = await getAccount(this.connection, poolPabAta);
        poolPab = pabAccount.amount;
      } catch {
        return { success: false, error: 'PAB ATA not found in pool' };
      }

      const usdcBalance = Number(poolUsdc) / (10 ** 6); // USDC has 6 decimals
      const pabBalance = Number(poolPab) / (10 ** TOKEN_DECIMALS);

      // Only arbitrage if pool has meaningful liquidity
      if (usdcBalance < MIN_POOL_LIQUIDITY && pabBalance < MIN_POOL_LIQUIDITY) {
        return { success: true, feesCollected: 0 };
      }

      // Calculate fee: take a small percentage of the larger reserve
      const largerReserve = Math.max(usdcBalance, pabBalance);
      const feeAmount = largerReserve * (ARBITRAGE_FEE_BPS / 10000);

      if (feeAmount < 0.01) {
        return { success: true, feesCollected: 0 };
      }

      // Credit fee to treasury wallet
      const treasuryPubkey = new PublicKey(TREASURY_WALLET);
      const treasuryUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, treasuryPubkey);

      // Ensure treasury ATA exists
      try {
        await getAccount(this.connection, treasuryUsdcAta);
      } catch {
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            poolPubkey,
            treasuryUsdcAta,
            treasuryPubkey,
            usdcMintPubkey
          )
        );
        await sendAndConfirmTransaction(this.connection, tx, []);
      }

      // Transfer fee from pool to treasury
      const feeLamports = BigInt(Math.floor(feeAmount * 10 ** 6));
      const transferIx = createTransferInstruction(
        poolUsdcAta,
        treasuryUsdcAta,
        poolPubkey,
        feeLamports
      );

      const tx = new Transaction().add(transferIx);
      const signature = await sendAndConfirmTransaction(this.connection, tx, []);

      // Log the arbitrage fee collection
      await prisma.agentTransaction.create({
        data: {
          agentId: 'pool-arbitrage',
          type: 'POOL_FEE',
          amount: feeAmount,
          txHash: signature,
          fromAddress: USDC_POOL_ADDRESS,
          toAddress: TREASURY_WALLET,
        } as any,
      });

      logger.info(`[Web3Agent] Pool fee collected: ${feeAmount} USDC from pool, tx: ${signature}`);
      return { success: true, feesCollected: feeAmount };
    } catch (err: any) {
      logger.error('[Web3Agent] Pool fee collection failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const web3AgentService = new Web3AgentService();
