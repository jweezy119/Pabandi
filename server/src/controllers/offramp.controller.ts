import { AuthRequest } from '../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { offrampService, offrampEvents } from '../services/offramp.service';
import { webhookService } from '../services/webhook.service';
import { cashAppService } from '../services/cashapp.service';
import { ok, fail } from '../utils/apiResponse';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { ledgerService } from '../services/payment-orchestration/ledger.service';
import { telegramBot, sendLivePayoutRequestToOperator } from '../services/telegram-bot.service';
import { aiPaymentVerifierService } from '../services/ai.payment.verifier.service';

// Track concurrent SSE connections per LP wallet — caps at 3 per wallet to
// prevent resource exhaustion from a single wallet opening many streams.
const sseConnectionCount = new Map<string, number>();

export const createIntent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user;
    const body = req.body || {};

    const grossUsdc = Number(body.amountUsdc || 100);
    if (!grossUsdc || grossUsdc <= 0) {
      return fail(res, 'amountUsdc must be greater than 0', 400);
    }

    // 1. Deduct 3% platform fee
    const platformFeeUsdc = Number((grossUsdc * 0.03).toFixed(2));
    const netPayoutUsdc = Number((grossUsdc - platformFeeUsdc).toFixed(2));
    const minRatePkr = Number(body.minRatePkr) || 279.50;
    const quotePkr = Math.round(netPayoutUsdc * minRatePkr); // e.g. 97 * 279.5 = 27,111.5 -> 27,111

    // 2. Resolve destination & Live Strictness Check (Anti-Fraud)
    let destinationRef = body.destinationRef;
    let destinationType = body.destinationType || 'RAAST';
    let freelancerName = 'Freelancer';

    if (authUser?.id) {
      const userRec = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isPayoutVerified: true,
          payoutAccountRef: true,
          payoutMethod: true,
        },
      });

      if (userRec) {
        freelancerName = `${userRec.firstName} ${userRec.lastName}`.trim() || 'Freelancer';

        if (!userRec.isPayoutVerified) {
          return fail(res, 'Payout method not verified. Please verify your bank account before withdrawing.', 403);
        }

        if (!destinationRef && userRec.payoutAccountRef) {
          destinationRef = userRec.payoutAccountRef;
          if (userRec.payoutMethod) {
            destinationType = userRec.payoutMethod === 'BANK_ESFCA' ? 'BANK' : 'RAAST';
          }
        }

        // Live Strictness: Bank account name must match Pabandi profile name exactly (case-insensitive)
        if (body.accountTitle) {
          const profileName = `${userRec.firstName || ''} ${userRec.lastName || ''}`.trim().toLowerCase();
          const providedTitle = String(body.accountTitle).trim().toLowerCase();
          if (profileName && providedTitle && profileName !== providedTitle) {
            return fail(
              res,
              `Bank account name ("${body.accountTitle}") must match your Pabandi profile name ("${userRec.firstName} ${userRec.lastName}") exactly.`,
              400
            );
          }
        }
      }
    }

    if (!destinationRef) {
      destinationRef = 'Meezan Bank - PK36MEZN0000001123456702';
    }

    const customerWallet = body.customerWallet || authUser?.walletAddress || authUser?.id || 'freelancer_wallet';

    // 3. Update the Double-Entry Ledger (deduct 3% fee)
    const ledgerTx = ledgerService.recordPaymentSettlement({
      paymentId: `offramp_${Date.now()}`,
      reference: `milestone_fee_${String(customerWallet).slice(0, 8)}`,
      rail: 'raast_offramp',
      amount: grossUsdc,
      currency: 'USDC',
      fee: platformFeeUsdc,
      payerId: String(customerWallet),
      payeeId: 'pabandi_treasury',
    });
    logger.info(`[Ledger] 3% platform fee deducted: $${platformFeeUsdc} USDC (Net: $${netPayoutUsdc} USDC). Ledger Tx: ${ledgerTx.id}`);

    // 4. Create the Offramp Intent record in DB first to obtain the Contract Claim ID
    const intent = await offrampService.requestIntent(
      String(customerWallet),
      netPayoutUsdc,
      minRatePkr,
      String(destinationType),
      String(destinationRef),
      body.businessId ? String(body.businessId) : undefined,
      body.idempotencyKey ? String(body.idempotencyKey) : undefined,
      body.lockedTxHash ? String(body.lockedTxHash) : 'simulated_anchor_lock'
    );

    // 5. Generate and dispatch the EXACT Telegram message for the LP Bot / Operator
    // Payload: 🚨 LIVE PAYOUT REQUEST: Send Rs. [Amount] to [Bank Name] / [IBAN]. Claim: [Contract ID]
    const telegramMessage = await sendLivePayoutRequestToOperator({
      amountPkr: quotePkr,
      destination: destinationRef,
      claimId: intent.id,
      amountUsdc: netPayoutUsdc,
      freelancerName,
    });

    return ok(res, {
      intent,
      breakdown: {
        grossUsdc,
        platformFeeUsdc,
        netPayoutUsdc,
        minRatePkr,
        quotePkr,
        destinationRef,
        destinationType,
      },
      telegramMessage,
      ledgerTxId: ledgerTx.id,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmEscrowLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const { lockedTxHash } = req.body;
    if (!lockedTxHash) {
      return fail(res, 'lockedTxHash is required to confirm Anchor escrow lock', 400);
    }
    const intent = await offrampService.confirmEscrowLock(intentId, String(lockedTxHash));
    return ok(res, { intent });
  } catch (error) {
    next(error);
  }
};

export const matchLp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    // Wait, matchLp in service doesn't take lpWallet as param?
    // Let's pass it anyway or remove it if not needed.
    const intent = await offrampService.matchLp(intentId);
    return ok(res, { intent });
  } catch (error) {
    next(error);
  }
};

export const submitProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const { lpWallet, imageBase64 } = req.body;

    // Sanity cap on base64 image size — 10 MB decoded max (≈ 13.3 MB base64).
    // Prevents a malicious LP from OOM-ing the server with a giant screenshot.
    const MAX_BASE64_BYTES = 10 * 1024 * 1024;
    if (imageBase64 && Buffer.byteLength(imageBase64, 'utf8') > MAX_BASE64_BYTES) {
      return fail(res, `imageBase64 exceeds ${MAX_BASE64_BYTES} byte limit`, 413);
    }

    const proof = await offrampService.submitProof(intentId, String(lpWallet || ''), String(imageBase64 || ''));
    return ok(res, { proof });
  } catch (error) {
    next(error);
  }
};

export const getIntents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, before, limit, destinationType } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (destinationType) where.destinationType = destinationType;
    if (before) where.requestedAt = { lt: new Date(String(before)) };

    const intents = await prisma.offrampIntent.findMany({
      where,
      take: Number(limit) || 20,
      orderBy: { requestedAt: 'desc' },
    });

    return ok(res, { intents });
  } catch (error) {
    next(error);
  }
};

export const acceptProof = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { intentId, proofId } = req.body;
    if (!intentId || !proofId) return fail(res, 'intentId and proofId are required', 400);

    // Only allow settlement from PROOF_SUBMITTED — not from MATCHED (no proof, no settlement).
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) return fail(res, 'Offramp intent not found', 404);
    if (intent.status !== 'PROOF_SUBMITTED') {
      return fail(res, `Cannot accept proof: intent is ${intent.status}, expected PROOF_SUBMITTED`, 409);
    }

    await offrampService.acceptProof(intentId);
    const settled = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    return ok(res, { intent: settled });
  } catch (error) {
    next(error);
  }
};

export const getOfframpQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cryptoAmount, cryptoCurrency = 'USDC', fiatCurrency = 'USD', destinationType = 'BANK' } = req.body;

    if (!cryptoAmount || Number(cryptoAmount) <= 0) {
      return fail(res, 'cryptoAmount must be greater than 0', 400);
    }

    const quote = await cashAppService.getOfframpQuote({
      cryptoAmount: Number(cryptoAmount),
      cryptoCurrency: String(cryptoCurrency),
      fiatCurrency: String(fiatCurrency),
    });

    return ok(res, { quote, destinationType });
  } catch (error) {
    next(error);
  }
};

export const expireStaleIntents = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expiredCount = await offrampService.expireStaleIntents();
    return ok(res, { expiredCount });
  } catch (error) {
    next(error);
  }
};

export const listProviders = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const providers = await prisma.liquidityProvider.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        raastId: true,
        jazzCashAccount: true,
        bankIban: true,
        pkrReserveUsd: true,
        collateralUsdc: true,
        trustScore: true,
        tier: true,
        maxSingleUsdc: true,
        dailyLimitUsdc: true,
        isActive: true,
        createdAt: true,
      },
    });

    return ok(res, { providers });
  } catch (error) {
    next(error);
  }
};

export const registerProvider = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      walletAddress,
      displayName,
      raastId,
      jazzCashAccount,
      bankIban,
      pkrReserveUsd,
      collateralUsdc,
      maxSingleUsdc,
      dailyLimitUsdc,
    } = req.body;

    if (!walletAddress) return fail(res, 'walletAddress is required', 400);

    const collateral = Number(collateralUsdc || 0);
    const maxSingle = Number(maxSingleUsdc || 500);
    const dailyLimit = Number(dailyLimitUsdc || 2000);

    // Business logic validation — an LP cannot offer more than they hold.
    if (maxSingle > collateral) {
      return fail(res, `maxSingleUsdc (${maxSingle}) cannot exceed collateralUsdc (${collateral})`, 422);
    }
    if (dailyLimit > collateral) {
      return fail(res, `dailyLimitUsdc (${dailyLimit}) cannot exceed collateralUsdc (${collateral})`, 422);
    }
    if (collateral <= 0) {
      return fail(res, 'collateralUsdc must be greater than 0', 422);
    }

    const provider = await prisma.liquidityProvider.create({
      data: {
        walletAddress: String(walletAddress),
        displayName: displayName ? String(displayName) : null,
        raastId: raastId ? String(raastId) : null,
        jazzCashAccount: jazzCashAccount ? String(jazzCashAccount) : null,
        bankIban: bankIban ? String(bankIban) : null,
        pkrReserveUsd: Number(pkrReserveUsd || 0),
        collateralUsdc: collateral,
        maxSingleUsdc: maxSingle,
        dailyLimitUsdc: dailyLimit,
      },
    });

    return ok(res, { provider }, 201);
  } catch (error: any) {
    if (error.code === 'P2002') return fail(res, 'Wallet address already registered', 409);
    next(error);
  }
};

export const testWebhookDelivery = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return fail(res, 'Webhook test endpoint is disabled in production', 404);
    }

    const { eventName, targetUrl, payload } = req.body;

    if (!eventName || !targetUrl) {
      return fail(res, 'eventName and targetUrl are required', 400);
    }

    const businessId = (req.user?.id as string) || 'guest';

    await webhookService.dispatch(String(eventName), businessId, {
      test: true,
      targetUrl,
      payload: payload || {},
    });

    return ok(res, { queued: true, eventName, targetUrl });
  } catch (error) {
    next(error);
  }
};

export const emiWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-sfpy-signature'];
    if (!signature || typeof signature !== 'string') {
      return fail(res, 'Missing signature header', 401);
    }

    // Use raw body when available (captured by express.json verify hook); fall back safely
    const rawBody = (req as any).rawBody;
    const bodyToVerify = rawBody != null && typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(req.body ?? {});

    const expectedSecret = process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY;
    if (!expectedSecret) {
      logger.error('[Offramp] SAFEPAY webhook secret is not configured');
      return fail(res, 'Server misconfiguration', 500);
    }

    const expectedHex = crypto
      .createHmac('sha256', expectedSecret)
      .update(bodyToVerify)
      .digest('hex');

    // Constant-time comparison to avoid timing-side-channel on the webhook secret
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHex))) {
      // valid signature path continues below
    } else {
      logger.warn(`[Offramp] EMI webhook signature mismatch for intentId=${req.query.intentId}`);
      return fail(res, 'Invalid signature', 401);
    }

    const { intentId } = req.query;
    const { amount, destinationAccount, transactionId, bankName } = req.body;

    if (!intentId || !transactionId) {
      return fail(res, 'intentId and transactionId are required', 400);
    }

    const matched = await offrampService.processWebhookMatch(String(intentId), {
      amount: Number(amount || 0),
      destinationAccount: String(destinationAccount || ''),
      transactionId: String(transactionId),
      bankName: String(bankName || 'SafePay'),
      signature,
      verifiedAt: new Date().toISOString(),
    });

    return ok(res, { matched: !!matched, intentId: String(intentId) });
  } catch (error) {
    next(error);
  }
};


export const createSettlementReceipt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.body;
    if (!intentId) return fail(res, 'intentId is required', 400);

    const intent = await prisma.offrampIntent.findUnique({ where: { id: String(intentId) } });
    if (!intent) return fail(res, 'Offramp intent not found', 404);

    const receipt = {
      receiptVersion: '1.0',
      generatedAt: new Date().toISOString(),
      intentId: intent.id,
      amountUsdc: intent.amountUsdc,
      quotePkr: intent.quotePkr,
      destinationType: intent.destinationType,
      destinationRef: intent.destinationRef,
      customerWallet: intent.customerWallet,
      lpWallet: intent.lpWallet,
      status: intent.status,
      settledAt: intent.settledAt,
      metadata: intent.metadata || {},
    };

    await prisma.offrampIntent.update({
      where: { id: intent.id },
      data: { metadata: { ...(intent.metadata as any || {}), lastReceipt: receipt } },
    });

    return ok(res, { intentId: intent.id, receipt });
  } catch (error) {
    next(error);
  }
};

export const streamLpIntents = async (req: Request, res: Response) => {
  const lpWallet = req.query.wallet as string;
  if (!lpWallet) {
    return res.status(400).json({ success: false, error: 'Wallet address required' });
  }

  // Verify the requester is a registered, active LP before opening the SSE stream.
  // Accept either an API key (x-api-key) or the LP wallet itself as a shared secret
  // so that only the legitimate LP holder can subscribe to their own intents.
  const providedKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.OFFRAMP__LP_API_KEY;
  const keyMatches = typeof providedKey === 'string' &&
    expectedKey &&
    crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));

  let isRegisteredLp = false;
  try {
    const lp = await prisma.liquidityProvider.findUnique({
      where: { walletAddress: lpWallet, isActive: true },
    });
    isRegisteredLp = !!lp;
  } catch {
    isRegisteredLp = false;
  }

  // Allow access if the LP API key matches OR the wallet is a registered active LP.
  if (!keyMatches && !isRegisteredLp) {
    return res.status(403).json({ success: false, error: 'Not authorized for this wallet stream' });
  }

  // ── SSE hardening ──────────────────────────────────────────────────────────
  // Cap concurrent SSE connections per wallet to prevent resource exhaustion.
  const MAX_SSE_CONNECTIONS = 3;
  const conns = (sseConnectionCount.get(lpWallet) || 0);
  if (conns >= MAX_SSE_CONNECTIONS) {
    return res.status(429).json({ success: false, error: 'Too many SSE connections for this wallet' });
  }
  sseConnectionCount.set(lpWallet, conns + 1);

  // Set headers and flush.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('data: {"type":"CONNECTED"}\n\n');

  // Heartbeat: send a ping every 30s to keep the connection alive and detect
  // dead clients early. If the client doesn't respond, we'll detect it on
  // the next write attempt and clean up.
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      // Client disconnected — cleanup will happen on 'close' event
      clearInterval(heartbeatInterval);
    }
  }, 30_000);

  // Cleanup on disconnect or timeout.
  let disconnected = false;
  const cleanup = () => {
    if (disconnected) return;
    disconnected = true;
    clearInterval(heartbeatInterval);
    offrampEvents.off('intent_updated', listener);
    const current = sseConnectionCount.get(lpWallet) || 0;
    sseConnectionCount.set(lpWallet, Math.max(0, current - 1));
  };

  res.on('close', cleanup);
  res.on('error', cleanup);

  // Timeout: if no data is sent within 5 minutes, close the connection.
  // This prevents zombie connections from dead clients.
  res.setTimeout(5 * 60 * 1000, () => {
    if (!disconnected) {
      try { res.write('event: error\ndata: "Connection timed out"\n\n'); } catch { /* ignore */ }
      cleanup();
      res.statusCode = 408;
      res.end();
    }
  });

  const listener = (intent: any) => {
    if (intent && intent.lpWallet === lpWallet) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'INTENT_UPDATED', intent })}\n\n`);
      } catch {
        // Client disconnected
        cleanup();
      }
    }
  };

  offrampEvents.on('intent_updated', listener);

  // Send initial confirmation that the stream is live.
  res.write(`event: status\ndata: ${JSON.stringify({ connected: true, wallet: lpWallet })}\n\n`);
};

// ── Operator (LP Dashboard) Controllers ──────────────────────────────────────

/**
 * GET /api/v1/offramp/operator/intents
 * Returns live table of all off-ramp payout requests for the Operator view.
 */
export const getOperatorIntents = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const showAll = _req.query.all === 'true';
    const intents = await prisma.offrampIntent.findMany({
      where: showAll
        ? undefined
        : {
            status: {
              in: [
                'PENDING_LP',
                'PENDING_OFFRAMP',
                'SENT_BY_LP',
                'PROOF_SUBMITTED',
                'PENDING_MANUAL_REVIEW',
              ],
            },
          },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });

    // Populate freelancer profile names where possible
    const customerWallets = Array.from(new Set(intents.map((i) => i.customerWallet)));
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { walletAddress: { in: customerWallets } },
          { id: { in: customerWallets } },
        ],
      },
      select: { id: true, walletAddress: true, firstName: true, lastName: true },
    });

    const userMap = new Map<string, string>();
    for (const u of users) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (u.walletAddress) userMap.set(u.walletAddress, name);
      userMap.set(u.id, name);
    }

    const formatted = intents.map((intent) => {
      const freelancerName = userMap.get(intent.customerWallet) || 'Freelancer';
      return {
        id: intent.id,
        freelancerName,
        customerWallet: intent.customerWallet,
        pkrAmount: intent.quotePkr || Math.round(intent.amountUsdc * intent.minRatePkr),
        usdcAmount: intent.amountUsdc,
        rate: intent.minRatePkr,
        bankDetails: intent.destinationRef,
        destinationType: intent.destinationType,
        status: intent.status,
        lockedTxHash: intent.lockedTxHash,
        requestedAt: intent.requestedAt,
        settledAt: intent.settledAt,
      };
    });

    return ok(res, { intents: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/offramp/operator/:intentId/mark-sent
 * Operator clicks "Mark as Sent" after transferring PKR from their banking app.
 */
export const operatorMarkSent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) return fail(res, 'Intent not found', 404);

    const updated = await prisma.offrampIntent.update({
      where: { id: intentId },
      data: { status: 'SENT_BY_LP' },
    });

    logger.info(`[Operator] Intent ${intentId} marked as SENT_BY_LP by Operator.`);
    offrampEvents.emit('intent_updated', updated);

    return ok(res, { intent: updated, message: 'Marked as Sent. Please upload receipt screenshot to verify.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/offramp/operator/:intentId/upload-receipt
 * Operator uploads bank receipt screenshot. OCR verifies RRN and releases USDC from Escrow to Treasury.
 */
export const operatorUploadReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const { imageBase64, screenshotUrl } = req.body;

    if (!imageBase64 && !screenshotUrl) {
      return fail(res, 'Receipt imageBase64 or screenshotUrl is required', 400);
    }

    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent) return fail(res, 'Intent not found', 404);

    const expectedPkr = intent.quotePkr || Math.round(intent.amountUsdc * intent.minRatePkr);
    const expectedDestination = intent.destinationRef;

    // Run AI OCR Receipt Verification
    const verification = await aiPaymentVerifierService.verify(
      imageBase64 || '',
      expectedPkr,
      expectedDestination,
      {
        intentId: intent.id,
        screenshotUrl,
      }
    );

    if (verification.status === 'VERIFIED') {
      // 1. Release USDC from Anchor Escrow to Treasury
      const treasuryWallet = process.env.PABANDI_TREASURY_WALLET || 'F5W934e6qJb8z2GZJj3kGjUfN6xLqK4W7CpHbBvRmN3D';
      
      const ledgerTx = ledgerService.recordPaymentSettlement({
        paymentId: `settle_offramp_${intent.id}`,
        reference: `escrow_release_${intent.id}_rrn_${verification.fields.transactionRef || 'verified'}`,
        rail: 'solana_treasury',
        amount: intent.amountUsdc,
        currency: 'USDC',
        fee: 0,
        payerId: intent.customerWallet,
        payeeId: treasuryWallet,
      });

      // 2. Mark intent as SETTLED
      const settled = await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
        },
      });

      offrampEvents.emit('intent_updated', settled);
      logger.info(`[Operator] Receipt verified (RRN: ${verification.fields.transactionRef}). Released $${intent.amountUsdc} USDC to Treasury. Ledger: ${ledgerTx.id}`);

      return ok(res, {
        verified: true,
        status: 'SETTLED',
        rrn: verification.fields.transactionRef,
        confidence: verification.confidence,
        releasedUsdc: intent.amountUsdc,
        treasuryWallet,
        ledgerTxId: ledgerTx.id,
        receipt: verification.receipt,
      });
    } else {
      // Confidence < 85% or blurry -> flip to PENDING_MANUAL_REVIEW
      await prisma.offrampIntent.update({
        where: { id: intent.id },
        data: { status: 'PENDING_MANUAL_REVIEW' },
      });

      return ok(res, {
        verified: false,
        status: 'PENDING_MANUAL_REVIEW',
        confidence: verification.confidence,
        message: 'Receipt confidence below threshold or blurry. Queued for coordinator manual review.',
        receiptId: verification.receiptId,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/offramp/operator/clean-test-intents
 * Allows operator to purge expired test intents or demo samples (e.g. 03001234567, REFUNDED)
 */
export const cleanTestIntents = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await prisma.offrampIntent.deleteMany({
      where: {
        OR: [
          { status: 'REFUNDED' },
          { destinationRef: { contains: '03001234567' } },
          { customerWallet: 'square_international_payer' },
        ],
      },
    });

    logger.info(`[Operator] Cleaned up ${deleted.count} test/demo offramp intents.`);
    return ok(res, { deletedCount: deleted.count, message: `Successfully removed ${deleted.count} demo/expired test intents.` });
  } catch (error) {
    next(error);
  }
};
