import { Router, Request, Response } from 'express';
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import * as spl from '@solana/spl-token';

/**
 * TEMPORARY migration endpoint — creates the new Token-2022 $PAB mint with
 * on-chain metadata (MetadataPointer) so the token is no longer flagged as spam.
 * Guarded by MIGRATION_TOKEN. REMOVE THIS FILE + ROUTE AFTER USE.
 */
const router = Router();
const META_URI = 'https://pabandi-42c5b.web.app/pab-metadata.json';
const NAME = 'Pabandi';
const SYMBOL = 'PAB';

router.post('/create-mint', async (req: Request, res: Response) => {
  const token = req.header('x-migration-token') || (req.body && req.body.token);
  if (!process.env.MIGRATION_TOKEN || token !== process.env.MIGRATION_TOKEN) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  try {
    const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const c = new Connection(rpc, 'confirmed');
    const kp = Keypair.fromSecretKey(
      (require('bs58').default || require('bs58')).decode(process.env.SOLANA_PRIVATE_KEY!)
    );
    const treasury = kp.publicKey;
    const mint = Keypair.generate();
    const T22 = spl.TOKEN_2022_PROGRAM_ID;
    const space = spl.getMintLen([spl.ExtensionType.MetadataPointer, spl.ExtensionType.MintCloseAuthority]);
    const lamports = await c.getMinimumBalanceForRentExemption(space);
    const tx = new Transaction();
    tx.add(SystemProgram.createAccount({ fromPubkey: treasury, newAccountPubkey: mint.publicKey, space, lamports, programId: T22 }));
    tx.add(spl.createInitializeMetadataPointerInstruction(mint.publicKey, treasury, mint.publicKey, T22));
    tx.add(spl.createInitializeMint2Instruction(mint.publicKey, 9, treasury, treasury, T22));
    tx.add(spl.createInitializeMintCloseAuthorityInstruction(mint.publicKey, treasury, T22));
    tx.add(spl.createInitializeInstruction({ programId: T22, mint: mint.publicKey, metadata: mint.publicKey, name: NAME, symbol: SYMBOL, uri: META_URI, mintAuthority: treasury, updateAuthority: treasury }));
    tx.feePayer = treasury;
    const sig = await sendAndConfirmTransaction(c, tx, [kp, mint]);
    const treasAta = await spl.getOrCreateAssociatedTokenAccount(c, kp, mint.publicKey, treasury, false, undefined, undefined, T22);
    const amt = BigInt('1000000000') * BigInt(10 ** 9);
    const sig2 = await spl.mintTo(c, kp, mint.publicKey, treasAta.address, kp, amt, [], undefined, T22);
    return res.json({ success: true, mintAddress: mint.publicKey.toBase58(), treasuryAta: treasAta.address.toBase58(), createTx: sig, mintTx: sig2 });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
