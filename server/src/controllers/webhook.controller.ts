import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

export const createWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { targetUrl, subscribedEvents } = req.body;

    // Verify ownership
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    // Generate signing secret
    const signingSecret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        businessId: business.id,
        targetUrl,
        subscribedEvents: subscribedEvents || ['*'],
        signingSecret,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Webhook endpoint created successfully',
      data: { webhook },
    });
  } catch (error) {
    next(error);
  }
};

export const getWebhooks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { webhooks },
    });
  } catch (error) {
    next(error);
  }
};

export const updateWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { targetUrl, subscribedEvents, isActive } = req.body;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        targetUrl,
        subscribedEvents,
        isActive,
      },
    });

    res.json({
      success: true,
      message: 'Webhook updated successfully',
      data: { webhook: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    await prisma.webhookEndpoint.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const regenerateSecret = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook) {
      throw new CustomError('Webhook not found', 404);
    }

    if (webhook.business.ownerId !== req.user!.id) {
      throw new CustomError('Unauthorized', 403);
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        signingSecret: newSecret,
      },
    });

    res.json({
      success: true,
      message: 'Webhook secret regenerated successfully',
      data: { signingSecret: updated.signingSecret },
    });
  } catch (error) {
    next(error);
  }
};
