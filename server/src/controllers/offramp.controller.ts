import { AuthRequest } from '../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { offrampService } from '../services/offramp.service';
import { webhookService } from '../services/webhook.service';
import { ok, fail } from '../utils/apiResponse';

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

    const intent = await offrampService.requestIntent({
      customerWallet: String(customerWallet),
      amountUsdc: Number(amountUsdc),
      minRatePkr: Number(minRatePkr || 0),
      destinationType: String(destinationType),
      destinationRef: String(destinationRef),
      businessId: businessId ? String(businessId) : undefined,
      lockedTxHash: lockedTxHash ? String(lockedTxHash) : undefined,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
    });

    return ok(res, { intent });
  } catch (error) {
    next(error);
  }
};

export const matchLp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const { lpWallet } = req.body;

    const intent = await offrampService.matchLp(intentId, String(lpWallet || ''));
    return ok(res, { intent });
  } catch (error) {
    next(error);
  }
};

export const submitProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intentId } = req.params;
    const { lpWallet, imageBase64 } = req.body;

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

    await offrampService.acceptProof(intentId, proofId);
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    return ok(res, { intent });
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

    const provider = await prisma.liquidityProvider.create({
      data: {
        walletAddress: String(walletAddress),
        displayName: displayName ? String(displayName) : null,
        raastId: raastId ? String(raastId) : null,
        jazzCashAccount: jazzCashAccount ? String(jazzCashAccount) : null,
        bankIban: bankIban ? String(bankIban) : null,
        pkrReserveUsd: Number(pkrReserveUsd || 0),
        collateralUsdc: Number(collateralUsdc || 0),
        maxSingleUsdc: Number(maxSingleUsdc || 500),
        dailyLimitUsdc: Number(dailyLimitUsdc || 2000),
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
