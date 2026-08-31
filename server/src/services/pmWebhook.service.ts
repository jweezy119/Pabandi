import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Fire webhooks for a given manager when a CRM event occurs.
 * Best-effort: failures are logged and counted but never block the caller.
 */
export async function fireWebhooks(managerId: string, event: string, payload: any) {
  try {
    const webhooks = await prisma.propertyWebhook.findMany({
      where: { managerId, active: true },
    });
    for (const wh of webhooks) {
      // Filter by event type.
      if (!wh.events.includes('all') && !wh.events.includes(event)) continue;
      // Sign the payload so the receiver can verify it came from Pabandi.
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');

      fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pabandi-Signature': signature, 'X-Pabandi-Event': event },
        body,
      })
        .then(async (r) => {
          await prisma.propertyWebhook.update({
            where: { id: wh.id },
            data: { lastDeliveredAt: new Date(), lastStatus: String(r.status) },
          });
          if (!r.ok) logger.warn(`[pm-webhook] ${wh.url} returned ${r.status} for ${event}`);
        })
        .catch(async (e: any) => {
          await prisma.propertyWebhook.update({
            where: { id: wh.id },
            data: { lastDeliveredAt: new Date(), lastStatus: 'ERROR', failCount: { increment: 1 } },
          });
          logger.warn(`[pm-webhook] ${wh.url} failed for ${event}: ${e.message}`);
        });
    }
  } catch (e: any) {
    logger.error(`[pm-webhook] fireWebhooks failed: ${e.message}`);
  }
}

/**
 * Record an activity in the CRM audit log.
 */
export async function logActivity(managerId: string, action: string, entityType: string, entityId: string, description: string, metadata?: any) {
  try {
    await prisma.propertyActivity.create({
      data: { managerId, action, entityType, entityId, description, metadata: metadata || null },
    });
  } catch (e: any) {
    logger.warn(`[pm-activity] logActivity failed: ${e.message}`);
  }
}
