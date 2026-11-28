import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

const ESCROW_PROGRAM_ID = new PublicKey('6ebgdhyUV7zEHqRmpnaPguWQPYJu9Vq4dpFs79VduTjG');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

interface InitializeEscrowAccounts {
  customer: PublicKey;
  business: PublicKey;
  mint: PublicKey;
  customerTokenAccount: PublicKey;
  escrowState: PublicKey;
  vaultTokenAccount: PublicKey;
  oracle: PublicKey;
}

/**
 * Anchor-compatible `initialize_escrow` instruction built directly with web3.js.
 * This removes the @coral-xyz/anchor runtime dependency (which pulls an unfixed
 * `toml` advisory) while producing the same 8-byte discriminator + Borsh args
 * that the Anchor client produced.
 */
export async function buildInitializeEscrowInstruction(
  args: {
    reservationId: string;
    trustScore: number;
    totalAmount: bigint;
    deadline: bigint;
  },
  accounts: InitializeEscrowAccounts,
): Promise<TransactionInstruction> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode('global:initialize_escrow'));
  const discriminator = Buffer.from(new Uint8Array(digest).slice(0, 8));

  const reservation = Buffer.from(args.reservationId, 'utf8');
  if (reservation.length > 32) throw new Error('Reservation id is too long');

  const length = Buffer.alloc(4);
  length.writeUInt32LE(reservation.length, 0);

  const trust = Buffer.alloc(1);
  trust.writeUInt8(Math.max(0, Math.min(255, args.trustScore)), 0);

  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(BigInt(args.totalAmount));

  const deadline = Buffer.alloc(8);
  deadline.writeBigInt64LE(BigInt(args.deadline));

  const data = Buffer.concat([discriminator, length, reservation, trust, amount, deadline]);

  const key = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
    pubkey,
    isSigner,
    isWritable,
  });

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      key(accounts.customer, true, true),
      key(accounts.business, false, false),
      key(accounts.mint, false, false),
      key(accounts.customerTokenAccount, false, true),
      key(accounts.escrowState, false, true),
      key(accounts.vaultTokenAccount, false, true),
      key(accounts.oracle, true, true),
      key(SystemProgram.programId, false, false),
      key(TOKEN_PROGRAM_ID, false, false),
      key(new PublicKey('SysvarRent111111111111111111111111111111111'), false, false),
    ],
    data,
  });
}

export function deriveBusinessPubkey(businessId: string): PublicKey {
  // The on-chain business account is keyed by a deterministic PDA derived from
  // the platform business id. Using a PDA keeps the instruction deterministic
  // without requiring a second env var for every business.
  return PublicKey.findProgramAddressSync(
    [Buffer.from('business'), Buffer.from(businessId)],
    ESCROW_PROGRAM_ID,
  )[0];
}

export { ESCROW_PROGRAM_ID };
