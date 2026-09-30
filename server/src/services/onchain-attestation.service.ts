import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function writeAttestation({
  passportId,
  eventType,
  referenceId,
  metadata = {},
}: {
  passportId: string;
  eventType: string;
  referenceId: string;
  metadata?: Record<string, any>;
}) {
  if (!process.env.SOLANA_ATTESTATION_KEYPAIR) {
    logger.warn('[attestation] no keypair configured, skipping');
    return { skipped: true };
  }

  try {
    const keypair = Keypair.fromSecretKey(
      Buffer.from(process.env.SOLANA_ATTESTATION_KEYPAIR, 'base64')
    );

    const hash = Buffer.from(
      `${passportId}:${eventType}:${referenceId}:${Date.now()}`
    ).toString('hex');

    const memoData = JSON.stringify({
      pabandi: 'trust_attestation',
      passportId,
      eventType,
      referenceId,
      hash,
      ...metadata,
    });

    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: keypair.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 1,
      })
    );

    const signature = await connection.sendTransaction(transaction, [keypair]);
    await connection.confirmTransaction(signature);

    const explorerUrl = `https://solscan.io/tx/${signature}`;

    await prisma.onchainAttestation.create({
      data: {
        passportId,
        eventType,
        referenceId,
        txSignature: signature,
        hash,
        explorerUrl,
      },
    });

    logger.info(`[attestation] wrote ${eventType} for ${passportId}: ${signature}`);

    return { signature, hash, explorerUrl };
  } catch (err: any) {
    logger.error(`[attestation] failed for ${eventType}: ${err.message}`);
    return { error: err.message };
  }
}

export async function getAttestationsForPassport(passportId: string) {
  return prisma.onchainAttestation.findMany({
    where: { passportId },
    orderBy: { createdAt: 'desc' },
  });
}
