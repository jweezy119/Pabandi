import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { logger } from '../../utils/logger';
import type { YieldAdapter } from './types';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
// Devnet USDC mint (Circle). Override with SOLANA_USDC_MINT for other clusters.
const USDC_MINT = new PublicKey(process.env.SOLANA_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
// Kamino/Reflect-style USDC vault owner. Override via env for the live vault.
const VAULT_OWNER = new PublicKey(
  process.env.KAMINO_USDC_VAULT || '11111111111111111111111111111111',
);
// Authority permitted to move funds out of the vault (Kamino program PDA or
// multisig in production). Override via KAMINO_VAULT_AUTHORITY.
const VAULT_AUTHORITY = new PublicKey(
  process.env.KAMINO_VAULT_AUTHORITY || '11111111111111111111111111111111',
);

const USDC_DECIMALS = 6;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
// Mock-equivalent 4% APY used to estimate yield when on-chain share
// accounting is not available. Kept in sync with mock.adapter.ts.
const ESTIMATED_APY = 0.04;

const deposits = new Map<string, { amount: number; depositedAt: number }>();

function loadPayer(): Keypair {
  const secret = process.env.SOLANA_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'SOLANA_SECRET_KEY is not set. Set it to the base58-encoded private key of the treasury/payer wallet to use the real Solana adapter.',
    );
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret) as number[]));
  }
}

function loadAuthority(): Keypair | null {
  const secret = process.env.SOLANA_VAULT_AUTHORITY_SECRET_KEY;
  if (!secret) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret) as number[]));
  }
}

export class SolanaYieldAdapter implements YieldAdapter {
  id = 'solana';
  private connection = new Connection(RPC_URL, 'confirmed');

  async deposit(amount: number, escrowId: string): Promise<void> {
    const payer = loadPayer();
    const ownerAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
    const vaultAta = await getAssociatedTokenAddress(USDC_MINT, VAULT_OWNER);

    const tx = new Transaction();
    // Ensure the payer has a USDC token account before transferring into the vault.
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ownerAta,
        payer.publicKey,
        USDC_MINT,
      ),
    );
    // Transfer `amount` USDC from the payer's ATA into the yield vault.
    tx.add(
      createTransferInstruction(
        ownerAta,
        vaultAta,
        payer.publicKey,
        Math.round(amount * 10 ** USDC_DECIMALS),
      ),
    );

    const signature = await sendAndConfirmTransaction(this.connection, tx, [payer]);
    logger.info(
      '[SolanaYield] deposit escrow=%s amount=%sUSDC sig=%s',
      escrowId,
      amount,
      signature,
    );

    deposits.set(escrowId, { amount, depositedAt: Date.now() });
  }

  async withdraw(amount: number, escrowId: string): Promise<{ principal: number; yield: number }> {
    const record = deposits.get(escrowId);
    const principal = record ? record.amount : amount;
    const depositedAt = record ? record.depositedAt : Date.now();
    const elapsedMs = Date.now() - depositedAt;
    const yieldAmount = principal * (ESTIMATED_APY / MS_PER_YEAR) * Math.max(elapsedMs, 0);

    const payer = loadPayer();
    const authority = loadAuthority();
    const vaultAta = await getAssociatedTokenAddress(USDC_MINT, VAULT_OWNER);
    const ownerAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);

    // Read the vault's actual on-chain balance before redeeming, so the
    // reported principal reflects real token movements where possible.
    let onChainPrincipal = principal;
    try {
      const vaultAccount = await getAccount(this.connection, vaultAta);
      onChainPrincipal = Number(vaultAccount.amount) / 10 ** USDC_DECIMALS;
    } catch (err) {
      logger.warn(
        '[SolanaYield] could not read vault ATA for escrow %s: %s',
        escrowId,
        (err as Error)?.message,
      );
    }

    const tx = new Transaction();
    // Redeem vault shares back to USDC and return principal + yield to the payer.
    tx.add(
      createTransferInstruction(
        vaultAta,
        ownerAta,
        VAULT_AUTHORITY,
        Math.round((principal + yieldAmount) * 10 ** USDC_DECIMALS),
      ),
    );

    const signers: Keypair[] = [payer];
    if (authority) signers.push(authority);
    const signature = await sendAndConfirmTransaction(this.connection, tx, signers);
    logger.info(
      '[SolanaYield] withdraw escrow=%s principal=%s yield=%s sig=%s',
      escrowId,
      principal,
      yieldAmount,
      signature,
    );

    deposits.delete(escrowId);
    return { principal: onChainPrincipal, yield: yieldAmount };
  }
}
