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

/** HMAC-signed outbound webhook delivery. Failures are logged, never thrown. */
async function deliverWebhooks(businessId: string, event: string, payload: unknown): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({ where: { businessId } });
    const body = JSON.stringify({ event, data: payload, deliveredAt: new Date().toISOString() });
    for (const endpoint of endpoints) {
      const events: string[] = Array.isArray(endpoint.subscribedEvents)
        ? (endpoint.subscribedEvents as string[])
        : [];
      if (!events.includes(event) && !events.includes('*')) continue;
      if (!endpoint.signingSecret) {
        logger.warn(`[CrmAutomation] webhook ${endpoint.id} has no signing secret; skipping`);
        continue;
      }
      try {
        const signature = crypto.createHmac('sha256', endpoint.signingSecret).update(body).digest('hex');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(endpoint.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pabandi-event': event,
            'x-pabandi-signature': signature,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch (error) {
        logger.warn(`[CrmAutomation] webhook ${endpoint.id} delivery failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    logger.warn(`[CrmAutomation] webhook lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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
        for (const action of actions) await applyAction(businessId, object, String(record.id), action);
        logger.info(`[CrmAutomation] rule ${rule.id} fired for ${object}.${event}`);
      }
      await deliverWebhooks(businessId, `${object}.${event}`, record);
    } catch (error) {
      logger.warn(`[CrmAutomation] emit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
}
