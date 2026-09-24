/**
 * Solana Escrow SDK
 * ─────────────────────────────────────────────
 * TypeScript SDK for interacting with the Pabandi on-chain escrow program.
 * Uses @solana/web3.js + @coral-xyz/anchor.
 */
import { Keypair, PublicKey, TransactionSignature } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
declare const PROGRAM_ID: PublicKey;
export interface EscrowAccount {
    buyer: PublicKey;
    seller: PublicKey;
    amount: bigint;
    mint: PublicKey;
    status: EscrowStatus;
    bump: number;
    reference: string;
}
export declare enum EscrowStatus {
    Created = 0,
    Funded = 1,
    Released = 2,
    Refunded = 3,
    Disputed = 4
}
export interface CreateEscrowParams {
    buyer: PublicKey;
    seller: PublicKey;
    amount: number;
    mint: PublicKey;
    reference: string;
    buyerKeypair?: Keypair;
}
export interface EscrowIdResult {
    escrowId: PublicKey;
    signature: TransactionSignature;
}
/**
 * Derive the escrow PDA address from buyer, seller, and reference.
 */
export declare function getEscrowPDA(buyer: PublicKey, seller: PublicKey, reference: string): [PublicKey, number];
/**
 * Derive the escrow PDA address from reference only (for lookup).
 * Note: This requires knowing the buyer and seller. For convenience,
 * we provide a helper that takes a known buyer and seller.
 */
export declare function deriveEscrowPDAFromReference(buyer: PublicKey, seller: PublicKey, reference: string): PublicKey;
/**
 * Create a new escrow on-chain.
 * The buyer pays for the escrow account creation.
 */
export declare function createEscrow(params: CreateEscrowParams): Promise<EscrowIdResult>;
/**
 * Fund an escrow. The buyer transfers USDC to the escrow's token account.
 */
export declare function fundEscrow(params: {
    escrowId: PublicKey;
    buyer: PublicKey;
    amount: number;
    mint: PublicKey;
}): Promise<TransactionSignature>;
/**
 * Release funds from escrow to the seller.
 */
export declare function releaseEscrow(params: {
    escrowId: PublicKey;
    authority: PublicKey;
    seller: PublicKey;
    mint: PublicKey;
}): Promise<TransactionSignature>;
/**
 * Refund funds from escrow back to the buyer.
 */
export declare function refundEscrow(params: {
    escrowId: PublicKey;
    authority: PublicKey;
    buyer: PublicKey;
    mint: PublicKey;
}): Promise<TransactionSignature>;
/**
 * Raise a dispute on an escrow.
 */
export declare function raiseDispute(params: {
    escrowId: PublicKey;
    disputant: PublicKey;
}): Promise<TransactionSignature>;
/**
 * Get the current on-chain state of an escrow.
 */
export declare function getEscrowState(escrowId: PublicKey): Promise<EscrowAccount | null>;
/**
 * Subscribe to escrow events from the program.
 */
export declare function listenForEscrowEvents(callback: (event: any) => void): number;
/**
 * Unsubscribe from escrow events.
 */
export declare function unsubscribeFromEscrowEvents(subscriptionId: number): Promise<void>;
export { PROGRAM_ID, TOKEN_PROGRAM_ID };
//# sourceMappingURL=sdk.d.ts.map