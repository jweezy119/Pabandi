import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { prisma } from '../utils/database';
import crypto from 'crypto';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

let _connection: Connection | null = null;

function getConnection(): Connection {
  if (!_connection) {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    _connection = new Connection(url, 'confirmed');
  }
  return _connection;
}

function getEncKey(): Buffer {
  const key = process.env.WALLET_ENC_KEY;
  if (!key) return crypto.scryptSync(process.env.JWT_SECRET || 'fallback', 'salt', 32);
  return Buffer.from(key, 'hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export class SolanaUsdcService {
  /**
   * Generate a new Solana keypair for an agent
   * Returns public key, stores encrypted secret
   */
  async createAgentWallet(agentId: string): Promise<{ publicKey: string; created: boolean }> {
    const existing = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (existing) return { publicKey: existing.publicKey, created: false };

    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Buffer.from(keypair.secretKey).toString('base64');
    const encryptedSecret = encrypt(secretKey);

    await prisma.agentWallet.create({
      data: {
        agentId,
        publicKey,
        encryptedSecret,
        balanceUsdc: 0,
      },
    });

    return { publicKey, created: true };
  }

  /**
   * Get the platform wallet address (public only)
   */
  getPlatformWallet(): string {
    return process.env.PLATFORM_WALLET_ADDRESS || '';
  }

  /**
   * Get USDC balance for any wallet address
   */
  async getUsdcBalance(walletAddress: string): Promise<number> {
    try {
      const mintKey = new PublicKey(USDC_MINT);
      const walletKey = new PublicKey(walletAddress);
      const tokenAddress = await getAssociatedTokenAddress(mintKey, walletKey);
      const accountInfo = await getConnection().getAccountInfo(tokenAddress);
      if (!accountInfo) return 0;
      const balance = await getConnection().getTokenAccountBalance(tokenAddress);
      return parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Record an on-chain USDC transfer in our treasury
   */
  async recordTransfer(params: {
    fromWallet: string;
    toWallet: string;
    amountUsdc: number;
    txHash: string;
    type: 'FUNDING' | 'AGENT_PAYMENT' | 'FEE_COLLECTION' | 'REFUND';
    referenceId?: string;
  }) {
    return prisma.usdcTransfer.create({
      data: {
        fromWallet: params.fromWallet,
        toWallet: params.toWallet,
        amountUsdc: params.amountUsdc,
        txHash: params.txHash,
        type: params.type,
        referenceId: params.referenceId,
        status: 'CONFIRMED',
        blockTime: new Date(),
      },
    });
  }

  /**
   * Build a transfer instruction for Phantom to sign
   */
  async buildTransferTransaction(params: {
    fromWallet: string;
    toWallet: string;
    amountUsdc: number;
  }): Promise<{ transaction: string; message: string }> {
    const mintKey = new PublicKey(USDC_MINT);
    const fromKey = new PublicKey(params.fromWallet);
    const toKey = new PublicKey(params.toWallet);

    const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
    const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

    const transaction = new Transaction();

    const toAccountInfo = await getConnection().getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromKey,
          toTokenAccount,
          toKey,
          mintKey
        )
      );
    }

    const amountRaw = Math.round(params.amountUsdc * 1_000_000);
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKey,
        amountRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await getConnection().getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;

    return {
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: `Transfer ${params.amountUsdc} USDC from ${params.fromWallet.slice(0, 8)}... to ${params.toWallet.slice(0, 8)}...`,
    };
  }

  /**
   * Get platform wallet USDC balance (public query)
   */
  async getPlatformBalance(): Promise<{ usdc: number; sol: number }> {
    const platformWallet = this.getPlatformWallet();
    if (!platformWallet) return { usdc: 0, sol: 0 };
    const usdc = await this.getUsdcBalance(platformWallet);
    try {
      const sol = await getConnection().getBalance(new PublicKey(platformWallet)) / LAMPORTS_PER_SOL;
      return { usdc, sol };
    } catch {
      return { usdc, sol: 0 };
    }
  }
}

export const solanaUsdc = new SolanaUsdcService();
