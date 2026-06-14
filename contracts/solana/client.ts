/**
 * Pabandi Solana Program IDL + TypeScript Client
 * ────────────────────────────────────────────────
 * This file documents the Pabandi Solana program interface and provides
 * a TypeScript client for interacting with deployed programs.
 *
 * Programs:
 *   1. pabandi_badge  — Soulbound reputation badge minting on Solana
 *   2. pabandi_escrow — Native SOL booking deposit escrow
 *
 * These complement the BSC contracts:
 *   • Solana badges = lower-cost minting, native to Phantom wallet
 *   • BSC escrow    = BUSD/BNB deposits for markets preferring EVM
 *
 * Usage:
 *   import { PabandiSolanaClient } from './client';
 *   const client = new PabandiSolanaClient(connection, wallet);
 *   await client.mintBadge(userPublicKey, 0, pseudoId, 85, 3);
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";

// ── Network Config ───────────────────────────────────────────────────────────

export const SOLANA_ENDPOINTS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet:  "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
} as const;

/**
 * Program IDs — update after deploying Anchor programs.
 * These are placeholder IDs that indicate where programs will live.
 */
export const PROGRAM_IDS = {
  // Placeholder — replace with actual program IDs after `anchor deploy`
  BADGE_PROGRAM:  new PublicKey("BadgPkeyPabandiReliabilityBadge1111111111111"),
  ESCROW_PROGRAM: new PublicKey("EscrowPkeyPabandiEscrow111111111111111111111"),
} as const;

// ── Badge Tiers ───────────────────────────────────────────────────────────────

export enum BadgeTier {
  Bronze   = 0,
  Silver   = 1,
  Gold     = 2,
  Platinum = 3,
}

export const BADGE_TIER_CONFIG = {
  [BadgeTier.Bronze]:   { name: "Bronze Patron",   emoji: "🥉", minBookings: 1,  minShowRate: 70 },
  [BadgeTier.Silver]:   { name: "Silver Reliable", emoji: "🥈", minBookings: 5,  minShowRate: 80 },
  [BadgeTier.Gold]:     { name: "Gold Trustee",    emoji: "🥇", minBookings: 10, minShowRate: 90 },
  [BadgeTier.Platinum]: { name: "Platinum Oracle", emoji: "💎", minBookings: 25, minShowRate: 97 },
} as const;

// ── IDL Type Definitions ──────────────────────────────────────────────────────
// These mirror the Anchor IDL that would be generated from Rust source.

export interface BadgeAccount {
  owner:            PublicKey;
  tier:             BadgeTier;
  pseudonymousId:   string;    // 32-byte hex HMAC
  reliabilityScore: number;    // 0–100
  totalBookings:    number;
  mintedAt:         number;    // Unix timestamp
  bump:             number;    // PDA bump seed
}

export interface EscrowAccount {
  customer:      PublicKey;
  business:      PublicKey;
  amountLamports: bigint;
  reservationId: string;    // 32-byte identifier
  status:        "open" | "released" | "refunded" | "forfeited";
  createdAt:     number;
  bump:          number;
}

// ── PDA Derivation ────────────────────────────────────────────────────────────

export function deriveBadgePDA(
  owner: PublicKey,
  tier: BadgeTier,
  programId: PublicKey = PROGRAM_IDS.BADGE_PROGRAM
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("badge"),
      owner.toBuffer(),
      Buffer.from([tier]),
    ],
    programId
  );
}

export function deriveEscrowPDA(
  reservationId: string,
  programId: PublicKey = PROGRAM_IDS.ESCROW_PROGRAM
): [PublicKey, number] {
  const idBytes = Buffer.from(reservationId.slice(0, 32).padEnd(32, "0"), "utf8");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), idBytes],
    programId
  );
}

// ── Client Class ─────────────────────────────────────────────────────────────

export class PabandiSolanaClient {
  private connection: Connection;
  private payer: Keypair; // Pabandi backend signer / relayer

  constructor(connection: Connection, payer: Keypair) {
    this.connection = connection;
    this.payer = payer;
  }

  /**
   * Check if a wallet holds a Pabandi badge at or above the given tier.
   * Uses PDA existence as proof — no RPC account data needed.
   */
  async verifyBadge(
    walletAddress: string,
    minTier: BadgeTier
  ): Promise<{ verified: boolean; highestTier: BadgeTier | null; badgePDA: string | null }> {
    const owner = new PublicKey(walletAddress);

    for (let tier = BadgeTier.Platinum; tier >= minTier; tier--) {
      const [pda] = deriveBadgePDA(owner, tier);
      const account = await this.connection.getAccountInfo(pda);
      if (account !== null) {
        return {
          verified: true,
          highestTier: tier,
          badgePDA: pda.toBase58(),
        };
      }
    }

    return { verified: false, highestTier: null, badgePDA: null };
  }

  /**
   * Get SOL balance for a wallet.
   */
  async getSolBalance(walletAddress: string): Promise<number> {
    const pubkey = new PublicKey(walletAddress);
    const lamports = await this.connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Simulate mint instruction (for testing without deployed program).
   * In production, this calls the Anchor program's `mint_badge` instruction.
   */
  simulateMintBadge(
    ownerAddress: string,
    tier: BadgeTier,
    pseudonymousId: string,
    reliabilityScore: number,
    totalBookings: number
  ): { pda: string; instruction: string } {
    const owner = new PublicKey(ownerAddress);
    const [pda, bump] = deriveBadgePDA(owner, tier);

    return {
      pda: pda.toBase58(),
      instruction: JSON.stringify({
        programId: PROGRAM_IDS.BADGE_PROGRAM.toBase58(),
        accounts: {
          badge:        pda.toBase58(),
          owner:        ownerAddress,
          payer:        this.payer.publicKey.toBase58(),
          systemProgram: SystemProgram.programId.toBase58(),
        },
        args: { tier, pseudonymousId, reliabilityScore, totalBookings, bump },
      }),
    };
  }

  /**
   * Simulate escrow creation (for testing without deployed program).
   */
  simulateCreateEscrow(
    customerAddress: string,
    businessAddress: string,
    reservationId: string,
    amountSol: number
  ): { pda: string; amountLamports: number } {
    const [pda] = deriveEscrowPDA(reservationId);
    return {
      pda: pda.toBase58(),
      amountLamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    };
  }
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Generate a privacy-preserving pseudonymous ID from a user ID.
 * Mirrors the server-side BadgeService.generatePseudonymousId().
 */
export function generatePseudonymousId(userId: string, salt: string): string {
  return createHash("sha256")
    .update(salt + userId)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Determine which badge tier a user qualifies for based on their stats.
 */
export function computeEligibleTier(
  totalBookings: number,
  showRate: number
): BadgeTier | null {
  if (totalBookings >= 25 && showRate >= 97) return BadgeTier.Platinum;
  if (totalBookings >= 10 && showRate >= 90) return BadgeTier.Gold;
  if (totalBookings >= 5  && showRate >= 80) return BadgeTier.Silver;
  if (totalBookings >= 1  && showRate >= 70) return BadgeTier.Bronze;
  return null;
}

export default PabandiSolanaClient;
