import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiPaymentVerifierService } from './ai.payment.verifier.service';
import { webhookService } from './webhook.service';

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
    idempotencyKey?: string;
  }) {
    if (input.idempotencyKey) {
      const recent = await prisma.offrampIntent.findFirst({
        where: { metadata: { path: ['idempotencyKey'], equals: input.idempotencyKey } },
        orderBy: { requestedAt: 'desc' },
      });

      if (recent && ['SETTLED', 'REFUNDED', 'DISPUTED', 'REJECTED'].includes(recent.status)) {
        return recent;
      }
    }

    if (!input.amountUsdc || input.amountUsdc <= 0) {
      throw new Error('Invalid amountUsdc: must be greater than 0');
    }
    const trimmedRef = String(input.destinationRef).trim();
    if (trimmedRef.length < 3 || trimmedRef.length > 64) {
      throw new Error('Invalid destinationRef: must be 3-64 characters');
    }

    const intent = await prisma.offrampIntent.create({
      data: {
        customerWallet: input.customerWallet,
        amountUsdc: input.amountUsdc,
        minRatePkr: input.minRatePkr,
        destinationType: input.destinationType,
        destinationRef: trimmedRef,
        businessId: input.businessId,
        lockedTxHash: input.lockedTxHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 2),
        quotePkr: +(input.amountUsdc * input.minRatePkr).toFixed(2),
        metadata: input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      },
    });

    logger.info(`[Offramp] Intent created ${intent.id} for ${input.customerWallet}`);
    if (input.businessId) {
      webhookService.dispatch('offramp.intent.created', input.businessId, {
        intentId: intent.id,
        amountUsdc: intent.amountUsdc,
        quotePkr: intent.quotePkr,
        destinationType: intent.destinationType,
        expiresAt: intent.expiresAt,
      });
    }
    return intent;
  }

  async matchLp(intentId: string, lpWallet: string) {
    const now = new Date();
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');
    if (intent.expiresAt && intent.expiresAt < now) {
      throw new Error('Intent expired');
    }
    if (intent.status !== 'PENDING_LP') {
      throw new Error(`Intent already ${intent.status}`);
    }

    const lp = await prisma.liquidityProvider.findUnique({
      where: { walletAddress: lpWallet },
    });

    if (!lp || !lp.isActive) {
      throw new Error('Liquidity provider not found or inactive');
    }

    if (intent.amountUsdc > lp.maxSingleUsdc) {
      throw new Error(`Amount exceeds LP max single payout of ${lp.maxSingleUsdc} USDC`);
    }

    const updated = await prisma.offrampIntent.update({
      where: { id: intentId },
      data: {
        status: 'MATCHED',
        lpWallet,
        matchedAt: new Date(),
      },
    });

    logger.info(`[Offramp] Intent ${intentId} matched with LP ${lpWallet}`);
    if (intent.businessId) {
      webhookService.dispatch('offramp.intent.matched', intent.businessId, {
        intentId: updated.id,
        lpWallet,
        matchedAt: updated.matchedAt,
        amountUsdc: updated.amountUsdc,
      });
    }
    return updated;
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
