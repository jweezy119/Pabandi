import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { offrampService } from '../services/offramp.service';
import { ok } from '../utils/apiResponse';

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
    } = req.body;

    const intent = await offrampService.requestIntent({
      customerWallet: String(customerWallet || ''),
      amountUsdc: Number(amountUsdc || 0),
      minRatePkr: Number(minRatePkr || 0),
      destinationType: String(destinationType || ''),
      destinationRef: String(destinationRef || ''),
      businessId,
      lockedTxHash,
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
