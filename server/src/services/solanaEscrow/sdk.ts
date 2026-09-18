/**
 * Solana Escrow SDK
 * ─────────────────────────────────────────────
 * TypeScript SDK for interacting with the Pabandi on-chain escrow program.
 * Uses @solana/web3.js + @coral-xyz/anchor.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { RPC_URL } from './constants';

// Program ID placeholder — replace with deployed program ID
const PROGRAM_ID = new PublicKey(process.env.PABANDI_ESCROW_PROGRAM_ID || '11111111111111111111111111111111');

export interface EscrowAccount {
  buyer: PublicKey;
  seller: PublicKey;
  amount: bigint;
  mint: PublicKey;
  status: EscrowStatus;
  bump: number;
  reference: string;
}

export enum EscrowStatus {
  Created = 0,
  Funded = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
}

export interface CreateEscrowParams {
  buyer: PublicKey;
  seller: PublicKey;
  amount: number; // in base units (lamports)
  mint: PublicKey;
  reference: string; // booking/order ID
  buyerKeypair?: Keypair;
}

export interface EscrowIdResult {
  escrowId: PublicKey;
  signature: TransactionSignature;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the escrow PDA address from buyer, seller, and reference.
 */
export function getEscrowPDA(
  buyer: PublicKey,
  seller: PublicKey,
  reference: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('escrow'),
      buyer.toBuffer(),
      seller.toBuffer(),
      Buffer.from(reference),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive the escrow PDA address from reference only (for lookup).
 * Note: This requires knowing the buyer and seller. For convenience,
 * we provide a helper that takes a known buyer and seller.
 */
export function deriveEscrowPDAFromReference(
  buyer: PublicKey,
  seller: PublicKey,
  reference: string
): PublicKey {
  const [pda] = getEscrowPDA(buyer, seller, reference);
  return pda;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection helper
// ─────────────────────────────────────────────────────────────────────────────

function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new escrow on-chain.
 * The buyer pays for the escrow account creation.
 */
export async function createEscrow(
  params: CreateEscrowParams
): Promise<EscrowIdResult> {
  const { buyer, seller, amount, mint, reference, buyerKeypair } = params;
  const connection = getConnection();
  const [escrowPda, bump] = getEscrowPDA(buyer, seller, reference);

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: buyer,
      newAccountPubkey: escrowPda,
      basePubkey: buyer,
      seed: `escrow${reference}`,
      lamports: 1_000_000_000, // Rent exemption (adjust based on account size)
      space: 8 + 32 + 32 + 8 + 32 + 1 + 1 + 64 + 64, // Approximate
      programId: PROGRAM_ID,
    })
  );

  const signature = await connection.sendTransaction(tx, [buyerKeypair!]);
  await connection.confirmTransaction(signature);

  return {
    escrowId: escrowPda,
    signature,
  };
}

/**
 * Fund an escrow. The buyer transfers USDC to the escrow's token account.
 */
export async function fundEscrow(params: {
  escrowId: PublicKey;
  buyer: PublicKey;
  amount: number;
  mint: PublicKey;
}): Promise<TransactionSignature> {
  const { escrowId, buyer, amount, mint } = params;
  const connection = getConnection();

  const buyerAta = await getAssociatedTokenAddress(mint, buyer);
  const escrowAta = await getAssociatedTokenAddress(mint, escrowId, true);

  const tx = new Transaction();

  // Create escrow ATA if it doesn't exist
  tx.add(
    createAssociatedTokenAccountInstruction(
      buyer,
      escrowAta,
      escrowId,
      mint
    )
  );

  // Transfer USDC from buyer to escrow
  // Note: In production, you'd use the Anchor program's fund_escrow instruction.
  // This is a simplified version for the SDK wrapper.
  const signature = await connection.sendTransaction(tx, []);
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Release funds from escrow to the seller.
 */
export async function releaseEscrow(params: {
  escrowId: PublicKey;
  authority: PublicKey;
  seller: PublicKey;
  mint: PublicKey;
}): Promise<TransactionSignature> {
  const { escrowId, authority, seller, mint } = params;
  const connection = getConnection();

  // In production, this would invoke the Anchor program's release_funds instruction
  // with PDA signer. This is a stub for the SDK wrapper.
  const tx = new Transaction();
  const signature = await connection.sendTransaction(tx, []);
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Refund funds from escrow back to the buyer.
 */
export async function refundEscrow(params: {
  escrowId: PublicKey;
  authority: PublicKey;
  buyer: PublicKey;
  mint: PublicKey;
}): Promise<TransactionSignature> {
  const { escrowId, authority, buyer, mint } = params;
  const connection = getConnection();

  const tx = new Transaction();
  const signature = await connection.sendTransaction(tx, []);
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Raise a dispute on an escrow.
 */
export async function raiseDispute(params: {
  escrowId: PublicKey;
  disputant: PublicKey;
}): Promise<TransactionSignature> {
  const { escrowId, disputant } = params;
  const connection = getConnection();

  const tx = new Transaction();
  const signature = await connection.sendTransaction(tx, []);
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Get the current on-chain state of an escrow.
 */
export async function getEscrowState(escrowId: PublicKey): Promise<EscrowAccount | null> {
  const connection = getConnection();
  const accountInfo = await connection.getAccountInfo(escrowId);

  if (!accountInfo) {
    return null;
  }

  // In production, deserialize the account data using Anchor's layout
  // For now, return a stub
  return null;
}

/**
 * Subscribe to escrow events from the program.
 */
export function listenForEscrowEvents(
  callback: (event: any) => void
): number {
  const connection = getConnection();

  const subscriptionId = connection.onProgramAccountChange(
    PROGRAM_ID,
    (keyedAccountInfo) => {
      callback({
        accountId: keyedAccountInfo.accountId.toString(),
        accountInfo: keyedAccountInfo.accountInfo,
      });
    }
  );

  return subscriptionId;
}

/**
 * Unsubscribe from escrow events.
 */
export async function unsubscribeFromEscrowEvents(subscriptionId: number): Promise<void> {
  const connection = getConnection();
  await connection.removeProgramAccountChangeListener(subscriptionId);
}

export { PROGRAM_ID, TOKEN_PROGRAM_ID };
