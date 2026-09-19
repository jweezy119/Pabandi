import { Connection, PublicKey, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

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

export class AutoApprovalService {
  private connection: Connection | null = null;
  private platformKeypair: Keypair | null = null;

  constructor() {
    this.loadPlatformKey();
  }

  private getConnection(): Connection {
    if (!this.connection) {
      const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this.connection = new Connection(url, 'confirmed');
    }
    return this.connection;
  }

  private loadPlatformKey() {
    const privateKeyBase58 = process.env.PLATFORM_PRIVATE_KEY;
    if (!privateKeyBase58) {
      console.warn('[AutoApproval] PLATFORM_PRIVATE_KEY not set');
      return;
    }
    try {
      const secretKey = bs58.decode(privateKeyBase58);
      this.platformKeypair = Keypair.fromSecretKey(secretKey);
      console.log(`[AutoApproval] Wallet: ${this.platformKeypair.publicKey.toBase58()}`);
    } catch (err: any) {
      console.error('[AutoApproval] Key load failed:', err.message);
    }
  }

  isEnabled(): boolean {
    return this.platformKeypair !== null;
  }

  getPlatformAddress(): string {
    return this.platformKeypair?.publicKey.toBase58() || '';
  }

  async getUsdcBalance(walletAddress?: string): Promise<number> {
    try {
      const mintKey = new PublicKey(USDC_MINT);
      const walletKey = new PublicKey(walletAddress || this.platformKeypair?.publicKey.toBase58() || '');
      const tokenAddress = await getAssociatedTokenAddress(mintKey, walletKey);
      const accountInfo = await this.getConnection().getAccountInfo(tokenAddress);
      if (!accountInfo) return 0;
      const balance = await this.getConnection().getTokenAccountBalance(tokenAddress);
      return parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch {
      return 0;
    }
  }

  async autoTransfer(params: {
    toWallet: string;
    amountUsdc: number;
    referenceId?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.platformKeypair) {
      return { success: false, error: 'Auto-approval not enabled' };
    }

    try {
      const mintKey = new PublicKey(USDC_MINT);
      const fromKey = this.platformKeypair.publicKey;
      const toKey = new PublicKey(params.toWallet);

      const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
      const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

      const transaction = new Transaction();

      const toAccountInfo = await this.getConnection().getAccountInfo(toTokenAccount);
      if (!toAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey)
        );
      }

      const amountRaw = Math.round(params.amountUsdc * 1_000_000);
      transaction.add(
        createTransferInstruction(
          fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID
        )
      );

      const { blockhash } = await this.getConnection().getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKey;
      transaction.sign(this.platformKeypair);

      const txHash = await this.getConnection().sendRawTransaction(transaction.serialize());
      await this.getConnection().confirmTransaction(txHash, 'confirmed');

      return { success: true, txHash };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getFullBalance(): Promise<{ usdc: number; sol: number }> {
    if (!this.platformKeypair) return { usdc: 0, sol: 0 };
    const usdc = await this.getUsdcBalance();
    try {
      const sol = await this.getConnection().getBalance(this.platformKeypair.publicKey) / LAMPORTS_PER_SOL;
      return { usdc, sol };
    } catch {
      return { usdc, sol: 0 };
    }
  }
}

export const autoApproval = new AutoApprovalService();
