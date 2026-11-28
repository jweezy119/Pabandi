import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { buildInitializeEscrowInstruction } from './escrowInstruction';

const key = (seed: number) => new PublicKey(new Uint8Array(32).fill(seed + 1));

describe('raw initialize_escrow instruction', () => {
  it('uses the Anchor discriminator and Borsh argument layout', async () => {
    const ix = await buildInitializeEscrowInstruction(
      { reservationId: 'session-1', trustScore: 80, totalAmount: 1_000_000_000n, deadline: 2_000_000_000n },
      {
        customer: key(1),
        business: key(9),
        mint: key(2),
        customerTokenAccount: key(3),
        escrowState: key(4),
        vaultTokenAccount: key(5),
        oracle: key(6),
      },
    );

    const expected = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:initialize_escrow')),
    ).slice(0, 8);
    expect(Array.from(ix.data.slice(0, 8))).toEqual(Array.from(expected));
    // 8 discriminator + 4 length + 9 string bytes + 1 u8 + 8 u64 + 8 i64
    expect(ix.data.length).toBe(8 + 4 + 9 + 1 + 8 + 8);
    expect(ix.keys).toHaveLength(10);
    expect(ix.keys[0].isSigner).toBe(true);
    expect(ix.keys[6].isSigner).toBe(true);
  });
});
