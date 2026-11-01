import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const PAB_MINT = new PublicKey(process.env.PAB_TOKEN_MINT || '11111111111111111111111111111111');
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function mintPabReward(providerPassportId: string, amount: number, jobId: string) {
  try {
    let wallet = await prisma.agentWallet.findFirst({
      where: { passportId: providerPassportId },
    });

    if (!wallet) {
      // Create PDA wallet for agent
      const pdaKeypair = Keypair.generate();
      wallet = await prisma.agentWallet.create({
        data: {
          agentId: `agent_${providerPassportId}`,
          passportId: providerPassportId,
          pdaAddress: pdaKeypair.publicKey.toBase58(),
          publicKey: pdaKeypair.publicKey.toBase58(),
          encryptedSecret: crypto.randomBytes(32).toString('hex'),
          pabBalance: 0,
          usdcBalance: 0,
        },
      });
    }

    // Mint PAB tokens to PDA (gasless - Pabandi pays)
    try {
      const mintAuthority = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(process.env.PAB_MINT_AUTHORITY_SECRET || '[]'))
      );
      
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        PAB_MINT,
        new PublicKey(wallet.pdaAddress),
        false,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      const txSignature = await mintTo(
        connection,
        mintAuthority,
        PAB_MINT,
        tokenAccount.address,
        mintAuthority,
        Math.round(amount * 1e9), // Assuming 9 decimals
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      await prisma.agentWallet.update({
        where: { id: wallet.id },
        data: { pabBalance: { increment: amount } },
      });

      await prisma.agentEarningsLedger.create({
        data: {
          walletId: wallet.id,
          mint: PAB_MINT.toBase58(),
          amount,
          type: 'reward',
          referenceId: jobId,
          txSignature,
        },
      });

      logger.info(`[PAB Reward] Minted ${amount} PAB to ${wallet.pdaAddress} for job ${jobId}`);
      return { success: true, txSignature };
    } catch (mintError) {
      logger.error('[PAB Reward] Mint error:', mintError);
      // Still record in ledger even if onchain mint fails
      await prisma.agentEarningsLedger.create({
        data: {
          walletId: wallet.id,
          mint: PAB_MINT.toBase58(),
          amount,
          type: 'reward',
          referenceId: jobId,
          txSignature: `pending_${crypto.randomUUID()}`,
        },
      });
      await prisma.agentWallet.update({
        where: { id: wallet.id },
        data: { pabBalance: { increment: amount } },
      });
      return { success: true, pending: true };
    }
  } catch (error) {
    logger.error('[PAB Reward] Error:', error);
    throw error;
  }
}
