import { enqueue, type EnqueueResult } from './connection';
import { webhookService } from '../services/webhook.service';
import { logger } from '../utils/logger';

/**
 * Agent webhook fan-out off the request path.
 *
 * ─── WHAT THIS ACTUALLY BUYS ────────────────────────────────────────────────
 * `webhookService.dispatch` is already fire-and-forget: it awaits a Prisma
 * read of the registered endpoints and then starts the HTTP sends without
 * waiting for them. So this is not fixing a blocked response the way the email
 * queue is.
 *
 * What it removes is the database read from the request. On a hot booking
 * create, `dispatch` currently costs a `webhookEndpoint.findMany` before the
 * handler can finish. Queuing moves that read into the worker.
 *
 * What it adds is durability and backpressure. Today a process that dies
 * between the handler returning and the third webhook being delivered loses
 * that delivery silently. Queued, the job is in Redis and is retried.
 */

export const WEBHOOK_QUEUE = 'pabandi-webhook';

export type WebhookJob =
  | { kind: 'business_endpoint'; event: string; businessId: string; payload: Record<string, unknown> }
  | { kind: 'oauth_clients'; userId: string; event: string; payload: Record<string, unknown> };

export async function runWebhookJob(job: WebhookJob): Promise<void> {
  switch (job.kind) {
    case 'business_endpoint':
      await webhookService.dispatch(job.event, job.businessId, job.payload);
      return;

    case 'oauth_clients':
      await webhookService.dispatchToOAuthClients(job.userId, job.event, job.payload);
      return;

    default: {
      const unreachable: never = job;
      throw new Error(`Unhandled webhook job: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Fire an event at a business's registered endpoints.
 *
 * Serialises the payload rather than passing the caller's object: a job can sit
 * in Redis for seconds, and a handler that mutates or reuses its payload
 * afterwards would otherwise change what the worker sends. JSON.stringify also
 * drops anything non-serialisable here rather than at the Redis client, where
 * the failure would be far less legible.
 */
export async function queueWebhook(
  event: string,
  businessId: string,
  payload: Record<string, unknown>
): Promise<EnqueueResult> {
  const job: WebhookJob = {
    kind: 'business_endpoint',
    event,
    businessId,
    payload: JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>,
  };

  return enqueue(WEBHOOK_QUEUE, event, job, runWebhookJob);
}

export async function queueOAuthWebhook(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<EnqueueResult> {
  const job: WebhookJob = {
    kind: 'oauth_clients',
    userId,
    event,
    payload: JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>,
  };

  return enqueue(WEBHOOK_QUEUE, event, job, runWebhookJob);
}

// NOTE ON THE APP-INTEGRATION QUEUE
//
// `webhookDeliveryService.enqueueWebhook` is a separate, database-backed queue
// for third-party app connections, and it has deliberately NOT been moved onto
// BullMQ here. It keys on appId and resolves the connection row inside the
// send, which is a different shape from the business-endpoint fan-out above and
// would need its own job kind rather than an `appId` smuggled into
// businessId.
//
// It is already non-blocking -- enqueueWebhook is a single INSERT -- so it was
// never what made a request slow. What it lacked was a consumer:
// `processWebhookQueue` existed and was called from nowhere, so those rows
// accumulated undelivered. The Phase 3 worker now drains it on an interval;
// see worker.ts.