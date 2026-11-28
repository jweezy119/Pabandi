import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export type CrmObject = 'client' | 'deal' | 'task';

interface Condition {
  field: string;
  operator?: 'equals' | 'not_equals' | 'contains';
  value: unknown;
}

type Action =
  | { type: 'setStatus'; value: string }
  | { type: 'createTask'; title: string }
  | { type: 'notify'; message: string };

function matches(record: Record<string, any>, conditions: Condition[]): boolean {
  return conditions.every(({ field, operator = 'equals', value }) => {
    const actual = record?.[field];
    if (operator === 'contains') return String(actual ?? '').toLowerCase().includes(String(value).toLowerCase());
    if (operator === 'not_equals') return actual !== value;
    return actual === value;
  });
}

async function applyAction(
  businessId: string,
  object: CrmObject,
  recordId: string,
  action: Action,
): Promise<void> {
  try {
    switch (action.type) {
      case 'setStatus': {
        const value = String(action.value || '');
        if (object === 'client') {
          await prisma.crmClient.updateMany({ where: { id: recordId, serviceBusinessId: businessId }, data: { status: value } });
        } else if (object === 'deal') {
          await prisma.crmDeal.updateMany({ where: { id: recordId, serviceBusinessId: businessId }, data: { stage: value } });
        } else {
          await prisma.crmTask.updateMany({ where: { id: recordId, serviceBusinessId: businessId }, data: { status: value } });
        }
        break;
      }
      case 'createTask':
        await prisma.crmTask.create({
          data: {
            title: String(action.title || 'Follow up'),
            serviceBusinessId: businessId,
            status: 'TODO',
            priority: 'MEDIUM',
            ...(object === 'client' ? { clientId: recordId } : {}),
            ...(object === 'deal' ? { dealId: recordId } : {}),
          },
        });
        break;
      case 'notify': {
        const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
        if (!business?.ownerId) break;
        await prisma.notification.create({
          data: {
            userId: business.ownerId,
            type: 'crm_automation',
            title: 'CRM automation',
            body: String(action.message || ''),
            actionUrl: `/contact/${object === 'client' ? 'clients' : object === 'deal' ? 'deals' : 'tasks'}/${recordId}`,
          },
        });
        break;
      }
    }
  } catch (error) {
    logger.warn(`[CrmAutomation] action ${action.type} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** HMAC-signed outbound webhook delivery. One row per attempt, retryable. */
export async function deliverWebhookDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await prisma.crmWebhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return false;
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: delivery.endpointId } });
  if (!endpoint?.signingSecret) {
    await prisma.crmWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastError: 'Webhook endpoint has no signing secret', attempts: { increment: 1 } },
    });
    return false;
  }

  const body = JSON.stringify({ event: delivery.event, data: delivery.payload, deliveredAt: new Date().toISOString() });
  const signature = crypto.createHmac('sha256', endpoint.signingSecret).update(body).digest('hex');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(endpoint.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pabandi-event': delivery.event,
        'x-pabandi-signature': signature,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const ok = response.ok;
    await prisma.crmWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: ok ? 'DELIVERED' : 'FAILED',
        lastError: ok ? null : `HTTP ${response.status}`,
        attempts: { increment: 1 },
        deliveredAt: ok ? new Date() : null,
      },
    });
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[CrmAutomation] webhook ${deliveryId} failed: ${message}`);
    await prisma.crmWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastError: message, attempts: { increment: 1 } },
    });
    return false;
  }
}

async function queueWebhooks(businessId: string, event: string, payload: unknown): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { businessId } });
  for (const endpoint of endpoints) {
    const events: string[] = Array.isArray(endpoint.subscribedEvents)
      ? (endpoint.subscribedEvents as string[])
      : [];
    if (!events.includes(event) && !events.includes('*')) continue;
    const delivery = await prisma.crmWebhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        businessId,
        event,
        payload: payload as any,
      },
    });
    void deliverWebhookDelivery(delivery.id);
  }
}

/** Generate a CRM alert and an in-app notification for notable record events. */
async function notifyNotableEvent(
  businessId: string,
  object: CrmObject,
  event: string,
  record: Record<string, any>,
): Promise<void> {
  const notable =
    (object === 'deal' && event === 'status_changed' && String(record.stage || '').toUpperCase() === 'LOST') ||
    (object === 'task' && record.priority === 'HIGH' && event === 'created');
  if (!notable) return;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
  if (!business?.ownerId) return;
  const title = object === 'deal' ? 'A deal was lost' : 'High-priority task created';
  const description = object === 'deal'
    ? `${record.title || 'Deal'} was marked lost — review the reason and follow up.`
    : `${record.title || 'Task'} needs attention.`;
  await prisma.crmAlert.create({
    data: {
      serviceBusinessId: businessId,
      type: object === 'deal' ? 'deal_lost' : 'high_priority_task',
      title,
      message: description,
      entityType: object,
      entityId: String(record.id),
    },
  }).catch(() => undefined);
  await prisma.notification.create({
    data: {
      userId: business.ownerId,
      type: 'crm_alert',
      title,
      body: description,
      actionUrl: `/contact/${object === 'deal' ? 'deals' : 'tasks'}/${record.id}`,
    },
  }).catch(() => undefined);
}

/**
 * Fire CRM rules and signed webhooks for a record event. Intentionally void:
 * automation must never turn a successful write into a failed response.
 */
export function emitCrmEvent(
  businessId: string,
  object: CrmObject,
  event: 'created' | 'updated' | 'status_changed',
  record: Record<string, any>,
): void {
  void (async () => {
    try {
      const rules = await prisma.crmAutomationRule.findMany({
        where: { serviceBusinessId: businessId, triggerObject: object, triggerEvent: event, enabled: true },
      });
      for (const rule of rules) {
        const conditions = (Array.isArray(rule.conditions) ? rule.conditions : []) as unknown as Condition[];
        if (!matches(record, conditions)) continue;
        const actions = (Array.isArray(rule.actions) ? rule.actions : []) as unknown as Action[];
        const run = await prisma.crmAutomationRun.create({
          data: {
            ruleId: rule.id,
            businessId,
            event: `${object}.${event}`,
            recordId: String(record.id),
            status: 'RUNNING',
          },
        });
        try {
          for (const action of actions) await applyAction(businessId, object, String(record.id), action);
          await prisma.crmAutomationRun.update({
            where: { id: run.id },
            data: { status: 'SUCCESS', actions: actions as any },
          });
          logger.info(`[CrmAutomation] rule ${rule.id} fired for ${object}.${event}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await prisma.crmAutomationRun.update({
            where: { id: run.id },
            data: { status: 'FAILED', error: message },
          });
        }
      }
      await notifyNotableEvent(businessId, object, event, record);
      await queueWebhooks(businessId, `${object}.${event}`, record);
    } catch (error) {
      logger.warn(`[CrmAutomation] emit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
}
