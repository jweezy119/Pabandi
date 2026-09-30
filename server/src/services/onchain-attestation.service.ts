import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

function computeHash(passportId: string, eventType: string, referenceId: string) {
  return Buffer.from(
    `${passportId}:${eventType}:${referenceId}:${Date.now()}`
  ).toString('hex');
}

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
  const hash = computeHash(passportId, eventType, referenceId);

  const existing = await prisma.onchainAttestation.findFirst({
    where: { passportId, eventType, referenceId },
  });

  if (existing) {
    return {
      skipped: true,
      reason: 'duplicate',
      attestation: existing,
    };
  }

  if (!process.env.SOLANA_ATTESTATION_KEYPAIR) {
    const pending = await prisma.onchainAttestation.create({
      data: {
        passportId,
        eventType,
        referenceId,
        txSignature: '',
        hash,
        explorerUrl: '',
        status: 'pending',
      },
    });

    logger.warn('[attestation] no keypair configured, wrote pending record');
    return { skipped: true, reason: 'no_keypair', attestation: pending };
  }

  try {
    const keypair = Keypair.fromSecretKey(
      Buffer.from(process.env.SOLANA_ATTESTATION_KEYPAIR, 'base64')
    );

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

    const confirmed = await prisma.onchainAttestation.create({
      data: {
        passportId,
        eventType,
        referenceId,
        txSignature: signature,
        hash,
        explorerUrl,
        status: 'confirmed',
      },
    });

    logger.info(`[attestation] wrote ${eventType} for ${passportId}: ${signature}`);

    return { signature, hash, explorerUrl, attestation: confirmed };
  } catch (err: any) {
    const failed = await prisma.onchainAttestation.create({
      data: {
        passportId,
        eventType,
        referenceId,
        txSignature: '',
        hash,
        explorerUrl: '',
        status: 'failed',
      },
    });

    logger.error(`[attestation] failed for ${eventType}: ${err.message}`);
    return { error: err.message, attestation: failed };
  }
}

export async function getAttestationsForPassport(passportId: string) {
  return prisma.onchainAttestation.findMany({
    where: { passportId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function retryPendingAttestations(limit = 20) {
  const pending = await prisma.onchainAttestation.findMany({
    where: { status: 'pending' },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  logger.info(`[attestation] retrying ${pending.length} pending attestations`);

  for (const attestation of pending) {
    try {
      const result = await writeAttestation({
        passportId: attestation.passportId,
        eventType: attestation.eventType,
        referenceId: attestation.referenceId,
      });

      if (result.attestation && result.attestation.status === 'confirmed') {
        await prisma.onchainAttestation.update({
          where: { id: attestation.id },
          data: {
            status: 'confirmed',
            txSignature: result.signature || attestation.txSignature,
            explorerUrl: result.explorerUrl || attestation.explorerUrl,
          },
        });
      }
    } catch (err: any) {
      logger.error(`[attestation] retry failed for ${attestation.id}: ${err.message}`);
    }
  }
}
