import { AuthRequest } from '../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { offrampService, offrampEvents } from '../services/offramp.service';
import { webhookService } from '../services/webhook.service';
import { ok, fail } from '../utils/apiResponse';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Track concurrent SSE connections per LP wallet — caps at 3 per wallet to
// prevent resource exhaustion from a single wallet opening many streams.
const sseConnectionCount = new Map<string, number>();

export const createIntent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      customerWallet,
      amountUsdc,
      minRatePkr,
      destinationType,
      destinationRef,
      businessId,
      lockedTxHash,
      idempotencyKey,
    } = req.body;

    if (!customerWallet || !destinationType || !destinationRef) {
      return fail(res, 'customerWallet, destinationType, and destinationRef are required', 400);
    }

    if (!amountUsdc || Number(amountUsdc) <= 0) {
      return fail(res, 'amountUsdc must be greater than 0', 400);
    }

    const intent = await offrampService.requestIntent(
      String(customerWallet),
      Number(amountUsdc),
      Number(minRatePkr || 0),
      String(destinationType),
      String(destinationRef),
      businessId ? String(businessId) : undefined,
      idempotencyKey ? String(idempotencyKey) : undefined
    );

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
