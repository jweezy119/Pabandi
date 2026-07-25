import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiPaymentVerifierService } from './ai.payment.verifier.service';

export type IntentStatus = 'PENDING_LP' | 'MATCHED' | 'PROOF_SUBMITTED' | 'SETTLED' | 'REFUNDED' | 'DISPUTED';

export class OfframpService {
  async requestIntent(input: {
    customerWallet: string;
    amountUsdc: number;
    minRatePkr: number;
    destinationType: string;
    destinationRef: string;
    businessId?: string;
    lockedTxHash?: string;
  }) {
    const intent = await prisma.offrampIntent.create({
      data: {
        customerWallet: input.customerWallet,
        amountUsdc: input.amountUsdc,
        minRatePkr: input.minRatePkr,
        destinationType: input.destinationType,
        destinationRef: input.destinationRef,
        businessId: input.businessId,
        lockedTxHash: input.lockedTxHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 2),
        quotePkr: +(input.amountUsdc * input.minRatePkr).toFixed(2),
      },
    });

    logger.info(`[Offramp] Intent created ${intent.id} for ${input.customerWallet}`);
    return intent;
  }

  async matchLp(intentId: string, lpWallet: string) {
    const lp = await prisma.liquidityProvider.findUnique({
      where: { walletAddress: lpWallet },
    });

    if (!lp || !lp.isActive) {
      throw new Error('Liquidity provider not found or inactive');
    }

    const intent = await prisma.offrampIntent.update({
      where: { id: intentId },
      data: {
        status: 'MATCHED',
        lpWallet,
        matchedAt: new Date(),
      },
    });

    logger.info(`[Offramp] Intent ${intentId} matched with LP ${lpWallet}`);
    return intent;
  }

  async submitProof(intentId: string, lpWallet: string, imageBase64: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');
    if (intent.lpWallet !== lpWallet) throw new Error('Forbidden');

    const result = await aiPaymentVerifierService.verify(
      imageBase64,
      Number(intent.quotePkr || 0),
      intent.destinationRef
    );

    const proof = await prisma.offrampProof.create({
      data: {
        intentId,
        lpWallet,
        imageBase64,
        verifyResult: result as any,
        confidence: result.confidence,
        plainTextExtract: result.fields as any,
      },
    });

    if (result.isValid && result.confidence >= 0.9) {
      await this.acceptProof(intentId, proof.id);
    } else if (result.isValid && result.confidence >= 0.4) {
      await prisma.offrampIntent.update({
        where: { id: intentId },
        data: { status: 'DISPUTED' },
      });
      await prisma.offrampProof.update({
        where: { id: proof.id },
        data: { status: 'DISPUTED', verifiedAt: new Date() },
      });
    } else {
      await prisma.offrampProof.update({
        where: { id: proof.id },
        data: { status: 'REJECTED', verifiedAt: new Date() },
      });
      await prisma.offrampIntent.update({
        where: { id: intentId },
        data: { status: 'MATCHED' },
      });
    }

    return proof;
  }

  async acceptProof(intentId: string, proofId: string) {
    await prisma.offrampProof.update({
      where: { id: proofId },
      data: { status: 'ACCEPTED', verifiedAt: new Date() },
    });

    await prisma.offrampIntent.update({
      where: { id: intentId },
      data: { status: 'SETTLED', settledAt: new Date() },
    });

    logger.info(`[Offramp] Intent ${intentId} settled via proof ${proofId}`);
  }

  async expireStaleIntents() {
    const now = new Date();
    const expired = await prisma.offrampIntent.findMany({
      where: { status: 'PENDING_LP', expiresAt: { lt: now } },
    });

    for (const intent of expired) {
      await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: { status: 'REFUNDED' },
      });
      logger.info(`[Offramp] Expired intent ${intent.id}`);
    }

    return expired.length;
  }
}

export const offrampService = new OfframpService();
