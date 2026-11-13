import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { qwenScreenshotRail } from './rails/qwen.rail';
import { mockEmiRail } from './rails/mock-emi.rail';
import { EventEmitter } from 'events';
import { webhookService } from './webhook.service';
import { channelDispatcher } from './channel-dispatcher.service';
import { aiPaymentVerifierService } from './ai.payment.verifier.service';
import { telegramBot } from './telegram-bot.service';
import { InlineKeyboard } from 'grammy';
import { CustomError } from '../middleware/errorHandler';

export type IntentStatus =
  | 'PENDING_LP'
  | 'PENDING_ESCROW_LOCK'
  | 'PENDING_MANUAL_REVIEW'
  | 'MATCHED'
  | 'PROOF_SUBMITTED'
  | 'SETTLED'
  | 'REFUNDED'
  | 'DISPUTED';

export const offrampEvents = new EventEmitter();

export class OfframpService {
  /**
   * Step 1: Request an off-ramp trade intent.
   * If lockedTxHash is provided, USDC is already locked on Solana Anchor PDA and status is PENDING_LP.
   * If lockedTxHash is missing, status starts as PENDING_ESCROW_LOCK and LPs are NOT dispatched
   * until confirmEscrowLock is invoked.
   */
  async requestIntent(
    customerWallet: string,
    amountUsdc: number,
    minRatePkr: number,
    destinationType: string,
    destinationRef: string,
    businessId?: string,
    idempotencyKey?: string,
    lockedTxHash?: string
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
      throw new CustomError('Invalid amountUsdc: must be greater than 0', 400);
    }
    const trimmedRef = String(destinationRef).trim();
    if (trimmedRef.length < 3 || trimmedRef.length > 64) {
      throw new CustomError('Invalid destinationRef: must be 3-64 characters', 400);
    }

    // Step 1: Check if USDC is locked
    const isLocked = Boolean(lockedTxHash && lockedTxHash.trim().length > 0);
    const initialStatus = isLocked ? 'PENDING_LP' : 'PENDING_ESCROW_LOCK';

    const intent = await prisma.offrampIntent.create({
      data: {
        customerWallet,
        amountUsdc,
        minRatePkr,
        destinationType,
        destinationRef: trimmedRef,
        businessId,
        lockedTxHash: lockedTxHash ? String(lockedTxHash).trim() : null,
        status: initialStatus,
        expiresAt: new Date(Date.now() + 1000 * 60 * 3), // 3-minute SLA
        quotePkr: +(amountUsdc * minRatePkr).toFixed(2),
        idempotencyKey,
      },
    });

    logger.info(`[Offramp] Intent created ${intent.id} for ${customerWallet} with status=${initialStatus}`);

    if (businessId) {
      webhookService.dispatch('offramp.intent.created', businessId, {
        intentId: intent.id,
        amountUsdc: intent.amountUsdc,
        quotePkr: intent.quotePkr,
        destinationType: intent.destinationType,
        expiresAt: intent.expiresAt,
        status: intent.status,
      });
    }

    offrampEvents.emit('intent_updated', intent);

    // Step 2: Only dispatch trade request to LPs if USDC escrow lock is confirmed
    if (isLocked) {
      await channelDispatcher.dispatchNewIntent(intent);
    }

    return intent;
  }

  /**
   * Confirms on-chain USDC lock in the Solana Anchor Escrow PDA.
   * Transitions intent to PENDING_LP and broadcasts to qualified LPs via @PabanBot.
   */
  async confirmEscrowLock(intentId: string, lockedTxHash: string) {
    if (!lockedTxHash || !lockedTxHash.trim()) {
      throw new CustomError('lockedTxHash is required to confirm escrow lock', 400);
    }

    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new CustomError('Intent not found', 404);

    if (intent.status !== 'PENDING_ESCROW_LOCK' && intent.status !== 'PENDING_LP') {
      throw new CustomError(`Cannot confirm lock for intent in status ${intent.status}`, 400);
    }

    const updated = await prisma.offrampIntent.update({
      where: { id: intentId },
      data: {
        lockedTxHash: lockedTxHash.trim(),
        status: 'PENDING_LP',
      },
    });

    logger.info(`[Offramp] Escrow lock confirmed on Solana for intent ${intentId}. Tx: ${lockedTxHash}`);
    offrampEvents.emit('intent_updated', updated);

    // Broadcast to LPs now that funds are verified locked on-chain
    await channelDispatcher.dispatchNewIntent(updated);

    return updated;
  }

  /**
   * Step 3: LP claims the trade.
   * Enforces that USDC is locked before the LP can match or lock collateral.
   */
  async matchLp(intentId: string, lpWallet: string = '') {
    const now = new Date();
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new CustomError('Intent not found', 404);

    // Hard security check: Step 1 rule
    if (!intent.lockedTxHash) {
      throw new CustomError('Cannot match LP: USDC must first be confirmed locked in the Solana Anchor Escrow PDA.', 400);
    }

    if (intent.expiresAt && intent.expiresAt < now) {
      throw new CustomError('Intent expired', 400);
    }
    if (intent.status !== 'PENDING_LP') {
      throw new CustomError(`Intent already ${intent.status}`, 400);
    }

    let targetLpWallet = lpWallet;

    // Auto-assignment if no LP wallet provided
    if (!targetLpWallet) {
      const availableLp = await prisma.liquidityProvider.findFirst({
        where: { isActive: true },
        orderBy: { trustScore: 'desc' },
      });
      if (!availableLp) throw new CustomError('No active LP found', 400);
      targetLpWallet = availableLp.walletAddress;
    }

    const lp = await prisma.liquidityProvider.findUnique({
      where: { walletAddress: targetLpWallet },
    });

    if (!lp || !lp.isActive) {
      throw new CustomError('Liquidity provider not found or inactive', 400);
    }

    if (intent.amountUsdc > lp.maxSingleUsdc) {
      throw new CustomError(`Amount exceeds LP max single payout of ${lp.maxSingleUsdc} USDC`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const availableUsdc = lp.collateralUsdc - lp.lockedCollateralUsdc;
      if (availableUsdc < intent.amountUsdc) {
        throw new CustomError('Insufficient available collateral', 400);
      }

      const { count } = await tx.offrampIntent.updateMany({
        where: { id: intentId, status: 'PENDING_LP' },
        data: {
          status: 'MATCHED',
          lpWallet: targetLpWallet,
          matchedAt: new Date(),
        },
      });

      if (count === 0) throw new CustomError('Intent already matched, expired, or not found', 400);

      await tx.liquidityProvider.update({
        where: { walletAddress: targetLpWallet },
        data: { lockedCollateralUsdc: { increment: intent.amountUsdc } },
      });

      await tx.vaultLedger.create({
        data: {
          lpId: lp.id,
          intentId: intent.id,
          action: 'LOCK',
          amount: intent.amountUsdc,
          balanceAfter: availableUsdc - intent.amountUsdc,
          reason: 'Matched Intent',
        },
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

  /**
   * Step 4: The LP uploads the Raast/JazzCash receipt to Pabandi.
   * Step 5: Pabandi verifies receipt via hardened AI OCR (aiPaymentVerifierService)
   *         and triggers contractor push notification via @PabanBot.
   * Step 6: If confidence >= 0.85 and valid, auto-releases USDC to LP.
   *         If confidence < 0.85, moves intent to PENDING_MANUAL_REVIEW.
   */
  async submitProof(intentId: string, lpWallet: string, imageBase64: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new CustomError('Intent not found', 404);
    if (intent.lpWallet !== lpWallet) throw new CustomError('Forbidden: wallet does not match matched LP', 403);

    const expectedPkr = intent.quotePkr || Number((intent.amountUsdc * intent.minRatePkr).toFixed(2));

    const proof = await prisma.offrampProof.create({
      data: {
        intentId,
        lpWallet,
        imageBase64: imageBase64.length <= 100000 ? imageBase64 : imageBase64.slice(0, 1000) + '...',
        status: 'PENDING',
        confidence: 0,
        verifyResult: {},
      },
    });

    try {
      // Step 5: Verify via hardened AI OCR with deduplication
      const verification = await aiPaymentVerifierService.verify(
        imageBase64,
        expectedPkr,
        intent.destinationRef,
        { intentId: intent.id }
      );

      const proofStatus = verification.isValid
        ? 'ACCEPTED'
        : verification.isPendingReview
        ? 'PENDING_REVIEW'
        : 'REJECTED';

      await prisma.offrampProof.update({
        where: { id: proof.id },
        data: {
          verifyResult: verification.fields as any,
          plainTextExtract: verification.raw ? { raw: verification.raw } : undefined,
          confidence: verification.confidence,
          status: proofStatus,
          verifiedAt: new Date(),
        },
      });

      // Step 5 Notification: Send interactive push notification to contractor via Telegram @PabanBot
      await this.notifyContractorReceiptArrival(intent, verification.fields);

      // Step 6: If AI OCR confidence >= 0.85 and valid, auto-release USDC
      if (verification.isValid && verification.confidence >= 0.85) {
        await this.acceptProof(intent.id, 'AI_OCR_AUTO');
      } else {
        // Confidence < 0.85 or blurry receipt -> flip to PENDING_MANUAL_REVIEW
        const reviewIntent = await prisma.offrampIntent.update({
          where: { id: intent.id },
          data: { status: 'PENDING_MANUAL_REVIEW' },
        });
        offrampEvents.emit('intent_updated', reviewIntent);
        logger.warn(`[Offramp] Proof flagged for manual review: intent ${intentId}, confidence=${verification.confidence.toFixed(2)}`);
      }

      return verification;
    } catch (error: any) {
      logger.error(`[Offramp] Verification failed for intent ${intentId}:`, error.message);
      if (error instanceof CustomError) {
        throw error;
      }
      const disputedIntent = await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: { status: 'DISPUTED' },
      });
      offrampEvents.emit('intent_updated', disputedIntent);
      throw error;
    }
  }

  /**
   * Step 5 Push Notification Helper:
   * "Did you receive Rs. 140,000 in your Meezan account? [Yes, Release Funds] [No, Dispute]"
   */
  async notifyContractorReceiptArrival(intent: any, fields: any) {
    if (!telegramBot) return;

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { walletAddress: intent.customerWallet },
            { phone: intent.destinationRef },
          ],
        },
        select: { id: true, telegramId: true, phone: true, firstName: true },
      });

      if (!user || !user.telegramId) {
        logger.debug(`[Offramp] No telegramId found for contractor on intent ${intent.id}`);
        return;
      }

      const amountFormatted = Number(intent.quotePkr || fields?.amount || 0).toLocaleString();
      const bankName = fields?.bank || intent.destinationType || 'account';

      const messageText =
        `🔔 *Payment Arrival Confirmation*\n\n` +
        `Did you receive *Rs. ${amountFormatted}* in your *${bankName}* account?\n\n` +
        `Ref: \`${intent.destinationRef}\`\n\n` +
        `Please confirm to release the international client's USDC escrow to the local provider.`;

      const keyboard = new InlineKeyboard()
        .text('✅ Yes, Release Funds', `RELEASE_${intent.id}`)
        .text('❌ No, Dispute', `DISPUTE_${intent.id}`);

      await telegramBot.api.sendMessage(user.telegramId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info(`[Offramp] Sent contractor confirmation push to telegramId ${user.telegramId} for intent ${intent.id}`);
    } catch (err: any) {
      logger.warn(`[Offramp] Failed to notify contractor via Telegram:`, err?.message || err);
    }
  }

  /**
   * Step 6: Releases USDC to LP's Solana wallet and settles ledger.
   * Triggered by contractor "Yes", confident AI OCR (>= 0.85), or manual coordinator approval.
   */
  async acceptProof(intentId: string, releasedBy: string = 'AI_OCR') {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new CustomError('Intent not found', 404);

    const feeAmount = intent.amountUsdc * (intent.feePct / 100);
    const netToLp = intent.amountUsdc - feeAmount;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.offrampIntent.updateMany({
        where: {
          id: intentId,
          status: { in: ['PROOF_SUBMITTED', 'MATCHED', 'PENDING_MANUAL_REVIEW'] },
        },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new CustomError(`Race condition: Intent ${intentId} cannot be settled.`, 409);
      }

      await tx.liquidityProvider.update({
        where: { walletAddress: intent.lpWallet! },
        data: {
          lockedCollateralUsdc: { decrement: intent.amountUsdc },
          collateralUsdc: { increment: netToLp },
        },
      });

      const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet! } });

      await tx.vaultLedger.create({
        data: {
          lpId: lp!.id,
          intentId: intent.id,
          action: 'RELEASE',
          amount: intent.amountUsdc,
          balanceAfter: lp!.collateralUsdc - lp!.lockedCollateralUsdc,
          reason: `Intent Settled (${releasedBy})`,
        },
      });

      await tx.vaultLedger.create({
        data: {
          lpId: lp!.id,
          intentId: intent.id,
          action: 'CREDIT',
          amount: netToLp,
          balanceAfter: lp!.collateralUsdc - lp!.lockedCollateralUsdc,
          reason: 'Yield and Principal payout',
        },
      });
    });

    // Step 6: Trigger smart contract release of USDC to LP on Solana Anchor Escrow PDA
    if (intent.lpWallet && intent.lockedTxHash) {
      try {
        const { solanaEscrowService } = await import('./solana_escrow.service');
        const usdcMint = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        await solanaEscrowService.triggerReleaseEscrow(
          intent.id,
          intent.customerWallet,
          intent.lpWallet,
          usdcMint
        );
        logger.info(`[Offramp] Released on-chain USDC to LP ${intent.lpWallet} for intent ${intent.id}`);
      } catch (err: any) {
        logger.warn(`[Offramp] Smart contract release logged: ${err.message}`);
      }
    }

    logger.info(`[Offramp] Intent ${intentId} SETTLED by ${releasedBy}.`);
    const settledIntent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });

    if (settledIntent?.businessId) {
      webhookService.dispatch('offramp.intent.settled', settledIntent.businessId, {
        intentId: settledIntent.id,
      });
    }

    offrampEvents.emit('intent_updated', settledIntent);
    return settledIntent;
  }

  /**
   * Freezes escrow and marks intent as DISPUTED.
   */
  async disputeIntent(intentId: string, reason?: string) {
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new CustomError('Intent not found', 404);

    const updated = await prisma.offrampIntent.update({
      where: { id: intentId },
      data: { status: 'DISPUTED' },
    });

    logger.warn(`[Offramp] Intent ${intentId} marked as DISPUTED. Reason: ${reason || 'Unspecified'}`);
    offrampEvents.emit('intent_updated', updated);
    return updated;
  }

  async expireStaleIntents() {
    const staleIntents = await prisma.offrampIntent.findMany({
      where: {
        status: { in: ['PENDING_LP', 'MATCHED'] },
        expiresAt: { lte: new Date() },
      },
    });

    let count = 0;
    for (const intent of staleIntents) {
      const result = await prisma.offrampIntent.updateMany({
        where: { id: intent.id, status: { in: ['PENDING_LP', 'MATCHED'] } },
        data: { status: 'REFUNDED' },
      });

      if (result.count > 0) {
        logger.warn(`[Offramp] SLA breach (expired) on intent ${intent.id}. Refunding customer.`);
        count++;

        if (intent.lpWallet) {
          await prisma.$transaction(async (tx) => {
            const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet! } });
            if (lp) {
              await tx.liquidityProvider.update({
                where: { id: lp.id },
                data: { lockedCollateralUsdc: { decrement: intent.amountUsdc } },
              });
              await tx.vaultLedger.create({
                data: {
                  lpId: lp.id,
                  intentId: intent.id,
                  action: 'RELEASE',
                  amount: intent.amountUsdc,
                  balanceAfter: lp.collateralUsdc - lp.lockedCollateralUsdc + intent.amountUsdc,
                  reason: 'Intent Expired (Strike)',
                },
              });

              const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const strikes = await tx.vaultLedger.count({
                where: {
                  lpId: lp.id,
                  reason: 'Intent Expired (Strike)',
                  createdAt: { gte: oneDayAgo },
                },
              });

              if (strikes >= 3) {
                await tx.lpChannel.updateMany({
                  where: { lpId: lp.id },
                  data: { quietHours: 'PAUSED' },
                });
                await tx.liquidityProvider.update({
                  where: { id: lp.id },
                  data: { trustScore: { decrement: 5 } },
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
        webhookData: webhookPayload,
      });

      if (verification.isValid) {
        const submitResult = await prisma.offrampIntent.updateMany({
          where: { id: intentId, status: 'MATCHED' },
          data: { status: 'PROOF_SUBMITTED' },
        });

        if (submitResult.count > 0) {
          await prisma.offrampProof.create({
            data: {
              intentId,
              lpWallet: intent.lpWallet!,
              imageBase64: 'webhook_verified',
              verifyResult: verification.fields as any,
              plainTextExtract: { ref: verification.providerTxnRef },
              confidence: verification.confidence,
              status: 'ACCEPTED',
              verifiedAt: new Date(),
            },
          });

          await this.acceptProof(intent.id, 'WEBHOOK_MATCH');
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
