import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { qwenScreenshotRail } from './rails/qwen.rail';
import { mockEmiRail } from './rails/mock-emi.rail';
import { EventEmitter } from 'events';
import { webhookService } from './webhook.service';

import { channelDispatcher } from './channel-dispatcher.service';

export type IntentStatus = 'PENDING_LP' | 'MATCHED' | 'PROOF_SUBMITTED' | 'SETTLED' | 'REFUNDED' | 'DISPUTED';
export const offrampEvents = new EventEmitter();

export class OfframpService {
  async requestIntent(
    customerWallet: string,
    amountUsdc: number,
    minRatePkr: number,
    destinationType: string,
    destinationRef: string,
    businessId?: string,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const recent = await prisma.offrampIntent.findUnique({
        where: { idempotencyKey },
      });

      if (recent && ['SETTLED', 'REFUNDED', 'DISPUTED', 'REJECTED'].includes(recent.status)) {
        return recent;
      } else if (recent) {
        return recent; // Already pending or matched
      }
    }

    if (!amountUsdc || amountUsdc <= 0) {
      throw new Error('Invalid amountUsdc: must be greater than 0');
    }
    const trimmedRef = String(destinationRef).trim();
    if (trimmedRef.length < 3 || trimmedRef.length > 64) {
      throw new Error('Invalid destinationRef: must be 3-64 characters');
    }

    const intent = await prisma.offrampIntent.create({
      data: {
        customerWallet,
        amountUsdc,
        minRatePkr,
        destinationType,
        destinationRef: trimmedRef,
        businessId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 2), // We will update TTL logic later based on trust tiers
        quotePkr: +(amountUsdc * minRatePkr).toFixed(2),
        idempotencyKey,
      },
    });

    logger.info(`[Offramp] Intent created ${intent.id} for ${customerWallet}`);
    if (businessId) {
      webhookService.dispatch('offramp.intent.created', businessId, {
        intentId: intent.id,
        amountUsdc: intent.amountUsdc,
        quotePkr: intent.quotePkr,
        destinationType: intent.destinationType,
        expiresAt: intent.expiresAt,
      });
    }

    offrampEvents.emit('intent_updated', intent);
    
    // Broadcast to LPs via ChannelDispatcher
    await channelDispatcher.dispatchNewIntent(intent);
    
    return intent;
  }

  async matchLp(intentId: string, lpWallet: string = '') {
    const now = new Date();
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');
    if (intent.expiresAt && intent.expiresAt < now) {
      throw new Error('Intent expired');
    }
    if (intent.status !== 'PENDING_LP') {
      throw new Error(`Intent already ${intent.status}`);
    }
    
    let targetLpWallet = lpWallet;
    
    // Auto-assignment if no LP wallet provided
    if (!targetLpWallet) {
        const availableLp = await prisma.liquidityProvider.findFirst({
            where: { isActive: true },
            orderBy: { trustScore: 'desc' }
        });
        if (!availableLp) throw new Error('No active LP found');
        targetLpWallet = availableLp.walletAddress;
    }

    const lp = await prisma.liquidityProvider.findUnique({
      where: { walletAddress: targetLpWallet },
    });

    if (!lp || !lp.isActive) {
      throw new Error('Liquidity provider not found or inactive');
    }

    if (intent.amountUsdc > lp.maxSingleUsdc) {
      throw new Error(`Amount exceeds LP max single payout of ${lp.maxSingleUsdc} USDC`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const availableUsdc = lp.collateralUsdc - lp.lockedCollateralUsdc;
      if (availableUsdc < intent.amountUsdc) {
        throw new Error('Insufficient available collateral');
      }

      const { count } = await tx.offrampIntent.updateMany({
        where: { id: intentId, status: 'PENDING_LP' },
        data: {
          status: 'MATCHED',
          lpWallet: targetLpWallet,
          matchedAt: new Date(),
        },
      });

      if (count === 0) throw new Error('Intent already matched, expired, or not found');

      await tx.liquidityProvider.update({
        where: { walletAddress: targetLpWallet },
        data: { lockedCollateralUsdc: { increment: intent.amountUsdc } }
      });

      await tx.vaultLedger.create({
        data: {
          lpId: lp.id,
          intentId: intent.id,
          action: 'LOCK',
          amount: intent.amountUsdc,
          balanceAfter: availableUsdc - intent.amountUsdc,
          reason: 'Matched Intent'
        }
      });

      return await tx.offrampIntent.findUniqueOrThrow({ where: { id: intentId } });
    });

    logger.info(`[Offramp] Intent ${intentId} matched with LP ${targetLpWallet}`);
    if (intent.businessId) {
      webhookService.dispatch('offramp.intent.matched', intent.businessId, {
        intentId: updated.id,
        lpWallet: targetLpWallet,
        matchedAt: updated.matchedAt,
        amountUsdc: updated.amountUsdc,
      });
    }

    offrampEvents.emit('intent_updated', updated);
    return updated;
  }

  async submitProof(intentId: string, lpWallet: string, imageBase64: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');
    if (intent.lpWallet !== lpWallet) throw new Error('Forbidden');

    const expectedPkr = intent.amountUsdc * intent.minRatePkr;

    const proof = await prisma.offrampProof.create({
      data: {
        intentId,
        lpWallet,
        imageBase64,
        status: 'PENDING',
        confidence: 0,
        verifyResult: {}
      },
    });

    try {
      const verification = await qwenScreenshotRail.verifyPayment({
        intentId: intent.id,
        screenshotBase64: imageBase64,
        expectedAmountPkr: expectedPkr,
        expectedDestination: intent.destinationRef
      });

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
        const disputedIntent = await prisma.offrampIntent.update({
          where: { id: intent.id },
          data: { status: 'DISPUTED' }
        });
        offrampEvents.emit('intent_updated', disputedIntent);
        logger.warn(`[Offramp] Proof rejected by AI for intent ${intentId}. Moving to DISPUTED.`);
      }

      return verification;
    } catch (error: any) {
      logger.error(`[Offramp] AI Verification threw error for ${intentId}: ${error.message}`);
      const disputedIntent = await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: { status: 'DISPUTED' }
      });
      offrampEvents.emit('intent_updated', disputedIntent);
      throw error;
    }
  }

  async acceptProof(intentId: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new Error('Intent not found');

    const feeAmount = intent.amountUsdc * (intent.feePct / 100);
    const netToLp = intent.amountUsdc - feeAmount;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.offrampIntent.updateMany({
        where: { id: intentId, status: { in: ['PROOF_SUBMITTED', 'MATCHED'] } },
        data: {
          status: 'SETTLED',
          settledAt: new Date()
        }
      });

      if (updated.count === 0) {
        throw new Error(`Race condition: Intent ${intentId} cannot be settled.`);
      }

      await tx.liquidityProvider.update({
        where: { walletAddress: intent.lpWallet! },
        data: {
          lockedCollateralUsdc: { decrement: intent.amountUsdc },
          collateralUsdc: { increment: netToLp }
        }
      });

      const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet! } });

      await tx.vaultLedger.create({
        data: {
          lpId: lp!.id,
          intentId: intent.id,
          action: 'RELEASE',
          amount: intent.amountUsdc,
          balanceAfter: lp!.collateralUsdc - lp!.lockedCollateralUsdc,
          reason: 'Intent Settled'
        }
      });
      await tx.vaultLedger.create({
        data: {
          lpId: lp!.id,
          intentId: intent.id,
          action: 'CREDIT',
          amount: netToLp,
          balanceAfter: lp!.collateralUsdc - lp!.lockedCollateralUsdc,
          reason: 'Yield and Principal payout'
        }
      });
    });

    logger.info(`[Offramp] Intent ${intentId} SETTLED.`);
    const settledIntent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    
    if (settledIntent?.businessId) {
        webhookService.dispatch('offramp.intent.settled', settledIntent.businessId, {
            intentId: settledIntent.id
        });
    }

    offrampEvents.emit('intent_updated', settledIntent);
    return settledIntent;
  }

  async expireStaleIntents() {
    const staleIntents = await prisma.offrampIntent.findMany({
      where: {
        status: { in: ['PENDING_LP', 'MATCHED'] },
        expiresAt: { lte: new Date() }
      }
    });

    let count = 0;
    for (const intent of staleIntents) {
      const result = await prisma.offrampIntent.updateMany({
        where: { id: intent.id, status: { in: ['PENDING_LP', 'MATCHED'] } },
        data: { status: 'REFUNDED' }
      });

      if (result.count > 0) {
        logger.warn(`[Offramp] SLA breach (180s expired) on intent ${intent.id}. Refunding customer.`);
        count++;

        if (intent.lpWallet) {
          // If it was matched, they held up the user. We must unlock their collateral.
           await prisma.$transaction(async (tx) => {
             const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet! } });
             if (lp) {
               await tx.liquidityProvider.update({
                 where: { id: lp.id },
                 data: { lockedCollateralUsdc: { decrement: intent.amountUsdc } }
               });
               await tx.vaultLedger.create({
                 data: {
                   lpId: lp.id,
                   intentId: intent.id,
                   action: 'RELEASE',
                   amount: intent.amountUsdc,
                   balanceAfter: (lp.collateralUsdc - lp.lockedCollateralUsdc) + intent.amountUsdc,
                   reason: 'Intent Expired (Strike)'
                 }
               });

               const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
               const strikes = await tx.vaultLedger.count({
                 where: {
                   lpId: lp.id,
                   reason: 'Intent Expired (Strike)',
                   createdAt: { gte: oneDayAgo }
                 }
               });

               if (strikes >= 3) {
                 await tx.lpChannel.updateMany({
                   where: { lpId: lp.id },
                   data: { quietHours: 'PAUSED' }
                 });
                 await tx.liquidityProvider.update({
                   where: { id: lp.id },
                   data: { trustScore: { decrement: 5 } }
                 });
                 logger.warn(`[Offramp] LP ${lp.walletAddress} hit 3 strikes in 24h. Trust decayed and channels paused.`);
               }
             }
          });
        }

        const refundedIntent = await prisma.offrampIntent.findUnique({ where: { id: intent.id } });
        if (refundedIntent) offrampEvents.emit('intent_updated', refundedIntent);
      }
    }

    return count;
  }

  async processWebhookMatch(intentId: string, webhookPayload: any) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    
    if (!intent || intent.status !== 'MATCHED') {
      logger.warn(`[Offramp] Webhook processed for intent ${intentId} but it is not MATCHED.`);
      return false;
    }

    const expectedPkr = intent.amountUsdc * intent.minRatePkr;

    try {
      const verification = await mockEmiRail.verifyPayment({
        intentId: intent.id,
        expectedAmountPkr: expectedPkr,
        expectedDestination: intent.destinationRef,
        webhookData: webhookPayload
      });

      if (verification.isValid) {
        const submitResult = await prisma.offrampIntent.updateMany({
          where: { id: intentId, status: 'MATCHED' },
          data: { status: 'PROOF_SUBMITTED' }
        });

        if (submitResult.count > 0) {
          await prisma.offrampProof.create({
            data: {
              intentId,
              lpWallet: intent.lpWallet!,
              imageBase64: 'webhook_verified',
              verifyResult: verification.fields as any,
              plainTextExtract: verification.providerTxnRef,
              confidence: verification.confidence,
              status: 'ACCEPTED',
              verifiedAt: new Date()
            }
          });

          await this.acceptProof(intent.id);
          return true;
        }
      } else {
        logger.warn(`[Offramp] Webhook payload did not match intent ${intentId}.`);
      }
    } catch (error: any) {
      logger.error(`[Offramp] Webhook Verification threw error for ${intentId}: ${error.message}`);
    }

    return false;
  }
}

export const offrampService = new OfframpService();
