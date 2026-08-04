import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';

// ── Config ─────────────────────────────────────────────────────────────
const MINT_ADDRESS = process.env.SOLANA_PAB_MINT_ADDRESS || 'Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ';
const TREASURY_WALLET = process.env.PABANDI_TREASURY_WALLET || '68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const TOKEN_DECIMALS = 9;
const MAX_DAILY_OUTFLOW = 100; // PAB per agent per day (compliance limit)
const MAX_TRANSACTIONS_PER_DAY = 10;

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
}

export const web3AgentService = new Web3AgentService();
