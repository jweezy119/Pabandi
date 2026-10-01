import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * CRM activities.
 *
 * WHAT WAS BROKEN HERE
 * No `authenticate`, and the tenant came from `?businessId=` or the request
 * body — so both endpoints were open to anyone, for any tenant.
 *
 * This router is mounted at /api/v1/crm/activities, AFTER /api/v1/crm in
 * index.ts. crm.routes.ts already declares the same paths and is registered
 * first, so Express never reaches this file for them. Authentication is
 * nevertheless required here, so the endpoints are not public the moment that
 * ordering changes.
 */

const router = Router();
router.use(authenticate);

/** The tenant this request may act on. Taken from the token, never the body. */
function requireBusinessId(req: AuthRequest): string {
  const businessId = req.user?.businessId ?? req.user?.activeBusinessId;
  if (!businessId) {
    throw new CustomError('No business is associated with this account', 403);
  }
  return businessId;
}

// List Activities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { clientId, dealId, type } = req.query;

    const where: Prisma.CrmActivityWhereInput = { businessId };
    if (clientId) where.clientId = String(clientId);
    if (dealId) where.dealId = String(dealId);
    if (type && type !== 'All') where.type = String(type);

    const activities = await prisma.crmActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { name: true, passportId: true } },
        deal: { select: { title: true } },
      },
    });
    res.json(activities);
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) {
      logger.error(`[Activities] list failed: ${err instanceof Error ? err.message : err}`);
    }
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to list activities' });
  }
});

// Create Activity
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { clientId, dealId, type, title, description, authorName } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const activity = await prisma.crmActivity.create({
      data: {
        businessId,
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type: type || 'NOTE',
        title: title.trim(),
        description: description ?? null,
        ...(authorName ? { authorName } : {}),
      },
      include: { client: true },
    });

    if (clientId && activity.client?.passportId) {
      // Activity logged attaches to the client timeline and trust record.
      await trustCore.emit('activity.logged', {
        clientId,
        passportId: activity.client.passportId,
        activityType: type,
      });
    }

    res.status(201).json(activity);
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) {
      logger.error(`[Activities] create failed: ${err instanceof Error ? err.message : err}`);
    }
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to create activity' });
  }
});

export default router;
