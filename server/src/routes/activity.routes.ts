import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { ACTIVITY_TYPES } from '../domain/crm';
import { crmScope } from '../services/crm.service';
import { logger } from '../utils/logger';

/**
 * CRM activities.
 *
 * WHAT WAS BROKEN HERE
 * No `authenticate`, and the tenant came from `?businessId=` or the request
 * body — so both endpoints were open to anyone, for any tenant.
 *
 * This router is mounted at /api/v1/crm/activities, AFTER /api/v1/crm in
 * index.ts. crm.routes.ts declares no /activities path of its own, so
 * requests fall through to this file.
 *
 * WHAT WAS BROKEN HERE, LATER
 * The tenant was taken from `req.user.businessId` -- the platform `Business.id`
 * -- and written straight into `CrmActivity.businessId`, the legacy column whose
 * documented meaning is the CrmBusiness table. The current anchor,
 * `serviceBusinessId`, was never written by any create path in the codebase.
 *
 * That is why every activity metric was empty. reports.service.ts scopes the
 * legacy CRM tables on `serviceBusinessId` only -- deliberately, with a comment
 * explaining that ORing in the platform id would add a clause that can never
 * match -- so a correctly-written activity was invisible to the activity report
 * while still showing up in this list. The two surfaces disagreed about which
 * column identified a tenant, and only one of them was ever populated.
 *
 * Both anchors are now written, and reads use the shared `crmScope`, which ORs
 * them. That keeps rows written before this fix (legacy anchor only) readable
 * instead of silently dropping the tenant's existing history.
 */

const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

// List Activities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const { clientId, dealId, type } = req.query;

    const where: Prisma.CrmActivityWhereInput = crmScope(
      crm.serviceBusinessId,
      crm.businessId,
    );
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
/**
 * Activity types are a closed set in the schema and in both forms, but the route
 * took whatever string arrived and stored it. `type: type || 'NOTE'` meant a
 * client sending "Call" produced a row that ActivityFeed's icon switch renders as
 * the default pencil — a call recorded as a note, with nothing to indicate why.
 *
 * TASK is rejected here on purpose. Tasks are a separate endpoint with their own
 * status, priority and completion handling, and an activity row masquerading as a
 * task would carry none of it: it would appear on no board and never complete.
 */
function parseActivityType(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'NOTE';
  if (typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value)) {
    return value;
  }
  throw new CustomError(
    `Invalid activity type. Expected one of: ${ACTIVITY_TYPES.join(', ')}`,
    400,
  );
}

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const { clientId, dealId, type, title, description, authorName } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const activity = await prisma.crmActivity.create({
      data: {
        // Both anchors. serviceBusinessId is the one reports and every other CRM
        // read scope on; businessId keeps the legacy column meaningful for the
        // cross-layer joins that still key off the platform Business.
        serviceBusinessId: crm.serviceBusinessId,
        businessId: crm.businessId ?? null,
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type: parseActivityType(type),
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
