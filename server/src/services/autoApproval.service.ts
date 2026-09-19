import { Connection, PublicKey, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import crypto from 'crypto';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ─── Encryption ──────────────────────────────────────────
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

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Auto-Approval Service ───────────────────────────────
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

  /**
   * Load platform private key from environment
   */
  private loadPlatformKey() {
    const privateKeyBase64 = process.env.PLATFORM_PRIVATE_KEY;
    if (!privateKeyBase64) {
      console.warn('[AutoApproval] PLATFORM_PRIVATE_KEY not set — auto-approval disabled');
      return;
    }
    try {
      const secretKey = Buffer.from(privateKeyBase64, 'base64');
      this.platformKeypair = Keypair.fromSecretKey(secretKey);
      console.log(`[AutoApproval] Platform wallet loaded: ${this.platformKeypair.publicKey.toBase58()}`);
    } catch (err) {
      console.error('[AutoApproval] Failed to load platform key:', err);
    }
  }

  /**
   * Check if auto-approval is enabled
   */
  isEnabled(): boolean {
    return this.platformKeypair !== null;
  }

  /**
   * Get platform wallet public address
   */
  getPlatformAddress(): string {
    return this.platformKeypair?.publicKey.toBase58() || '';
  }

  /**
   * Get USDC balance for any wallet address
   */
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

  /**
   * AUTO-APPROVE: Sign and submit USDC transfer
   * No Phantom popup — fully automatic
   */
  async autoTransfer(params: {
    toWallet: string;
    amountUsdc: number;
    referenceId?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.platformKeypair) {
      return { success: false, error: 'Auto-approval not enabled — PLATFORM_PRIVATE_KEY not set' };
    }

    try {
      const mintKey = new PublicKey(USDC_MINT);
      const fromKey = this.platformKeypair.publicKey;
      const toKey = new PublicKey(params.toWallet);

      const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
      const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

      const transaction = new Transaction();

      // Create destination token account if it doesn't exist
      const toAccountInfo = await this.getConnection().getAccountInfo(toTokenAccount);
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

      // Add transfer instruction (USDC has 6 decimals)
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

      // Sign with platform key (auto-approve)
      const { blockhash } = await this.getConnection().getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKey;
      transaction.sign(this.platformKeypair);

      // Submit to Solana
      const txHash = await this.getConnection().sendRawTransaction(transaction.serialize());

      // Confirm the transaction
      await this.getConnection().confirmTransaction(txHash, 'confirmed');

      console.log(`[AutoApproval] Transferred ${params.amountUsdc} USDC to ${params.toWallet.slice(0, 8)}... — tx: ${txHash}`);

      return { success: true, txHash };
    } catch (err: any) {
      console.error('[AutoApproval] Transfer failed:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate a new dedicated platform wallet
   * Returns the address to fund (private key is shown ONCE)
   */
  static generateWallet(): { publicKey: string; privateKeyBase64: string } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKeyBase64: Buffer.from(keypair.secretKey).toString('base64'),
    };
  }

  /**
   * Get full platform balance (USDC + SOL)
   */
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
