/**
 * webhookDelivery.service.ts — reliable webhook delivery for app integrations.
 *
 * When an app connects via POST /api/v1/apps/connect it can register a webhookUrl.
 * This service queues + retries webhook delivery for:
 *   - booking outcomes
 *   - agent trust updates
 *   - PTP attestation issuance
 *   - treasury events
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface WebhookPayload {
  appId: string;
  event: string;
  data: Record<string, any>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 10_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deliverOnce(url: string, payload: any): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Pabandi-Webhook/1.0' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function enqueueWebhook(opts: WebhookPayload): Promise<void> {
  const app = await prisma.appConnection.findUnique({
    where: { id: opts.appId },
    select: { id: true, webhookUrl: true, status: true },
  });

  if (!app?.webhookUrl || app.status !== 'ACTIVE') return;

  await prisma.webhookDelivery.create({
    data: {
      appId: opts.appId,
      event: opts.event,
      payload: opts.data as any,
      status: 'QUEUED',
      attempts: 0,
    } as any,
  });
}

export async function processWebhookQueue(): Promise<{ delivered: number; failed: number }> {
  const pending = await prisma.webhookDelivery.findMany({
    where: { status: { not: 'DELIVERED' } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let delivered = 0;
  let failed = 0;

  for (const wh of pending) {
    const app = await prisma.appConnection.findUnique({
      where: { id: wh.appId },
      select: { webhookUrl: true, status: true },
    });

    if (!app?.webhookUrl || app.status !== 'ACTIVE') {
      await prisma.webhookDelivery.update({ where: { id: wh.id }, data: { status: 'SKIPPED' } as any });
      failed++;
      continue;
    }

    let ok = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      ok = await deliverOnce(app.webhookUrl, { event: wh.event, data: wh.payload, deliveredAt: new Date().toISOString() });
      if (ok) break;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }

    await prisma.webhookDelivery.update({
      where: { id: wh.id },
      data: {
        status: ok ? 'DELIVERED' : 'FAILED',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        nextAttemptAt: ok ? null : new Date(Date.now() + RETRY_DELAY_MS * 2),
      } as any,
    });

    if (ok) delivered++;
    else failed++;
  }

  return { delivered, failed };
}

export const webhookDeliveryService = { enqueueWebhook, processWebhookQueue };
