import { PublicKey } from '@solana/web3.js';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

/**
 * Associated-token-address derivation using the maintained @solana-program/token
 * package instead of the deprecated @solana/spl-token (which carries unfixed
 * native-dependency advisories). Callers still get a legacy web3.js PublicKey so
 * existing transaction code does not have to be rewritten.
 */
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  _allowOwnerOffCurve = false,
): Promise<PublicKey> {
  const [pda] = await findAssociatedTokenPda({
    mint: mint.toBase58() as any,
    owner: owner.toBase58() as any,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return new PublicKey(pda);
}
