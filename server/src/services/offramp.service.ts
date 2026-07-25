import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiPaymentVerifier } from './ai.payment.verifier.service';

export class OfframpService {
  private readonly DEFAULT_FEE_PCT = parseFloat(process.env.OFFRAMP__DEFAULT_FEE_PCT || '0.85');
  private readonly MAX_INTENT_TTL_SEC = parseInt(process.env.OFFRAMP__MAX_INTENT_TTL_SEC || '180');

  /**
   * 1. Customer initiates an intent
   */
  async requestIntent(
    customerWallet: string,
    amountUsdc: number,
    minRatePkr: number,
    destinationType: string,
    destinationRef: string,
    businessId?: string,
    idempotencyKey?: string
  ) {
    logger.info(`[Offramp] Intent requested: ${amountUsdc} USDC to ${destinationType} (${destinationRef})`);

    // Idempotency check
    if (idempotencyKey) {
      const existing = await prisma.offrampIntent.findUnique({
        where: { idempotencyKey }
      });
      if (existing) {
        logger.info(`[Offramp] Idempotency key hit for ${idempotencyKey}, returning existing intent.`);
        return existing;
      }
    }

    // In a real flow, USDC would be locked in escrow here, returning a lockedTxHash.
    // We mock that step for Phase 0.
    const lockedTxHash = `mock_lock_${Date.now()}`;

    const intent = await prisma.offrampIntent.create({
      data: {
        customerWallet,
        businessId,
        amountUsdc,
        minRatePkr,
        destinationType,
        destinationRef,
        lockedTxHash,
        feePct: this.DEFAULT_FEE_PCT,
        idempotencyKey,
        expiresAt: new Date(Date.now() + this.MAX_INTENT_TTL_SEC * 1000),
        status: 'PENDING_LP'
      }
    });

    // Try to match immediately
    this.matchLp(intent.id).catch(err => {
      logger.error(`[Offramp] Initial LP match failed for intent ${intent.id}: ${err.message}`);
    });

    return intent;
  }

  /**
   * 2. System routes to best Liquidity Provider
   */
  async matchLp(intentId: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.status !== 'PENDING_LP') {
      throw new Error('Intent not found or not PENDING_LP');
    }

    const expectedPkr = intent.amountUsdc * intent.minRatePkr;

    // Find LP with enough reserve and active
    const lp = await prisma.liquidityProvider.findFirst({
      where: {
        isActive: true,
        pkrReserveUsd: { gte: intent.amountUsdc }
      },
      orderBy: { trustScore: 'desc' }
    });

    if (!lp) {
      logger.warn(`[Offramp] No LP available for intent ${intentId} (${expectedPkr} PKR)`);
      return null;
    }

    // Compare and Swap (CAS) transition to prevent double-matching
    const matchResult = await prisma.offrampIntent.updateMany({
      where: { id: intentId, status: 'PENDING_LP' },
      data: {
        status: 'MATCHED',
        lpWallet: lp.walletAddress,
        matchedAt: new Date()
      }
    });

    if (matchResult.count === 0) {
      logger.warn(`[Offramp] Race condition: Intent ${intentId} is no longer PENDING_LP.`);
      return null;
    }

    logger.info(`[Offramp] Intent ${intentId} MATCHED with LP ${lp.walletAddress}. Awaiting proof.`);
    return await prisma.offrampIntent.findUnique({ where: { id: intentId } });
  }

  /**
   * 3. LP submits image proof of fiat transfer
   */
  async submitProof(intentId: string, lpWallet: string, imageBase64: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    
    if (!intent || intent.status !== 'MATCHED' || intent.lpWallet !== lpWallet) {
      throw new Error('Invalid intent state or unauthorized LP');
    }

    // HARD EXPIRY GUARD
    if (intent.expiresAt && new Date() > intent.expiresAt) {
      throw new Error('Intent has expired. Cannot submit proof.');
    }

    logger.info(`[Offramp] Proof received for intent ${intentId} from LP ${lpWallet}`);

    // Compare and Swap transition to prevent double-submission or late submission after refund
    const submitResult = await prisma.offrampIntent.updateMany({
      where: { id: intentId, status: 'MATCHED' },
      data: { status: 'PROOF_SUBMITTED' }
    });

    if (submitResult.count === 0) {
      throw new Error('Race condition: Intent is no longer MATCHED (might be expired or already submitted).');
    }

    const proof = await prisma.offrampProof.create({
      data: {
        intentId,
        lpWallet,
        imageBase64,
        verifyResult: {},
        confidence: 0,
        status: 'PENDING'
      }
    });

    const expectedPkr = intent.amountUsdc * intent.minRatePkr;
    
    // Call AI Verifier
    try {
      const verification = await aiPaymentVerifier.verify(
        imageBase64,
        expectedPkr,
        intent.destinationRef
      );

      await prisma.offrampProof.update({
        where: { id: proof.id },
        data: {
          verifyResult: verification.fields as any,
          plainTextExtract: verification.rawJson,
          confidence: verification.confidence,
          status: verification.isValid ? 'ACCEPTED' : 'REJECTED',
          verifiedAt: new Date()
        }
      });

      if (verification.isValid) {
        await this.acceptProof(intent.id);
      } else {
        // AI rejected it, trigger dispute
        await prisma.offrampIntent.update({
          where: { id: intent.id },
          data: { status: 'DISPUTED' }
        });
        logger.warn(`[Offramp] Proof rejected by AI for intent ${intentId}. Moving to DISPUTED.`);
      }

      return verification;
    } catch (error: any) {
      logger.error(`[Offramp] AI Verification threw error for ${intentId}: ${error.message}`);
      await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: { status: 'DISPUTED' }
      });
      throw error;
    }
  }

  /**
   * 4. Auto-accept and release escrow (ATOMIC SETTLEMENT)
   */
  async acceptProof(intentId: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');

    // FIX FEE MATH: Convert 0.85 to 0.0085 (percent to fraction)
    const feeAmount = intent.amountUsdc * (intent.feePct / 100);
    const netToLp = intent.amountUsdc - feeAmount;

    // Execute atomic transaction for money movement
    await prisma.$transaction(async (tx) => {
      // 1. CAS state transition
      const updated = await tx.offrampIntent.updateMany({
        where: { id: intentId, status: 'PROOF_SUBMITTED' },
        data: {
          status: 'SETTLED',
          settledAt: new Date()
        }
      });

      if (updated.count === 0) {
        throw new Error(`Race condition: Intent ${intentId} is no longer PROOF_SUBMITTED. Double-settle prevented.`);
      }

      // 2. Release escrow (mocked DB balances for Phase 0)
      await tx.liquidityProvider.update({
        where: { walletAddress: intent.lpWallet! },
        data: {
          pkrReserveUsd: { decrement: intent.amountUsdc },
          collateralUsdc: { increment: netToLp }
        }
      });
    });

    logger.info(`[Offramp] Intent ${intentId} SETTLED. Escrow released to ${intent.lpWallet}. Fee collected: ${feeAmount} USDC.`);
    return await prisma.offrampIntent.findUnique({ where: { id: intentId } });
  }

  /**
   * 5. State Machine SLA Timer (Cron)
   */
  async expireStaleIntents() {
    const staleIntents = await prisma.offrampIntent.findMany({
      where: {
        status: { in: ['PENDING_LP', 'MATCHED'] },
        expiresAt: { lte: new Date() }
      }
    });

    let count = 0;
    for (const intent of staleIntents) {
      // Use CAS to ensure we don't refund something that just settled
      const result = await prisma.offrampIntent.updateMany({
        where: { id: intent.id, status: { in: ['PENDING_LP', 'MATCHED'] } },
        data: { status: 'REFUNDED' }
      });

      if (result.count > 0) {
        logger.warn(`[Offramp] SLA breach (180s expired) on intent ${intent.id}. Refunding customer.`);
        count++;
      }
    }

    return count;
  }
}

export const offrampService = new OfframpService();
