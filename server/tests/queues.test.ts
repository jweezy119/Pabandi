import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { enqueue, closeQueues } from '../src/queues/connection';
import { runEmailJob, type EmailJob } from '../src/queues/email.queue';
import { runWebhookJob, type WebhookJob } from '../src/queues/webhook.queue';

/**
 * The fallback is the part that has to be right.
 *
 * Redis is not provisioned in this repo's environments yet, so the inline path
 * is not a theoretical branch -- it is the path every request takes today. If
 * it throws, every queued email and webhook becomes a 500 on a route that used
 * to work.
 *
 * These run with no REDIS_URL, which is the real configuration right now.
 */

describe('enqueue with no Redis configured', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw, and reports that it ran inline', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);

    const result = await enqueue('test-queue', 'test-job', { a: 1 }, processor);

    expect(result.mode).toBe('inline');
    expect(result.jobId).toMatch(/^inline-/);
  });

  it('resolves before the processor runs -- that is the whole point', async () => {
    let processorFinished = false;
    const processor = vi.fn(async () => {
      // A slow processor stands in for a slow email provider.
      await new Promise((resolve) => setTimeout(resolve, 200));
      processorFinished = true;
    });

    const result = await enqueue('test-queue', 'test-job', {}, processor);

    expect(processorFinished).toBe(false);
    expect(result.mode).toBe('inline');

    // And it does eventually run.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(processorFinished).toBe(true);
  });

  it('swallows a throwing processor instead of taking the process down', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('resend exploded'));

    await expect(enqueue('test-queue', 'test-job', {}, processor)).resolves.toBeDefined();

    // An unhandled rejection here would terminate the Node process, which is
    // the exact failure mode Phase 3 was asked to prevent.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(processor).toHaveBeenCalled();
  });

  it('survives a processor that rejects synchronously', async () => {
    const processor = vi.fn().mockImplementation(() => {
      throw new Error('threw immediately');
    });

    await expect(
      enqueue('test-queue', 'test-job', {}, processor as unknown as (d: unknown) => Promise<void>)
    ).resolves.toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  it('passes the payload through unchanged', async () => {
    let seen: unknown;
    const processor = vi.fn(async (data: unknown) => {
      seen = data;
    });

    const payload = { sessionId: 'abc', amount: 42 };
    await enqueue('test-queue', 'test-job', payload, processor);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(seen).toEqual(payload);
  });
});

describe('email job payloads', () => {
  it('survives a Redis JSON round trip -- no Date, no undefined leaking through', async () => {
    const job: EmailJob = {
      kind: 'booking_confirmation',
      data: {
        to: 'guest@example.com',
        businessName: 'The Lounge',
        date: '2026-11-01',
        time: '20:00',
        guests: 4,
        // Optional and absent: `undefined` is dropped by JSON.stringify, so a
        // worker reading it back sees a missing key rather than undefined.
        confirmationCode: undefined,
      },
    };

    const roundTripped = JSON.parse(JSON.stringify(job)) as EmailJob;

    expect(roundTripped.kind).toBe('booking_confirmation');
    if (roundTripped.kind !== 'booking_confirmation') return;
    expect(roundTripped.data.guests).toBe(4);
    expect(roundTripped.data.confirmationCode).toBeUndefined();
  });

  it('handles every email job kind without throwing', async () => {
    // emailService.sendEmail returns { skipped: true } with no RESEND_API_KEY,
    // which is the state these tests run in. The point is that every branch of
    // runEmailJob is reachable and type-correct, not that mail is delivered.
    const jobs: EmailJob[] = [
      { kind: 'booking_confirmation', data: { to: 'a@b.com', businessName: 'B', date: 'd', time: 't', guests: 1 } },
      { kind: 'booking_reminder', data: { to: 'a@b.com', businessName: 'B', date: 'd', time: 't', guests: 1 } },
      { kind: 'promo', data: { to: 'a@b.com', businessName: 'B', promoTitle: 'p', promoDescription: 'd' } },
      { kind: 'verification', data: { to: 'a@b.com', code: '123456' } },
      { kind: 'welcome', data: { to: 'a@b.com', name: 'A' } },
      { kind: 'trust_score_changed', data: { to: 'a@b.com', field: 'reliabilityScore', oldScore: 50, newScore: 60 } },
    ];

    for (const job of jobs) {
      await expect(runEmailJob(job)).resolves.toBeUndefined();
    }
  });
});

describe('webhook job payloads', () => {
  it('handles every webhook job kind', async () => {
    const jobs: WebhookJob[] = [
      { kind: 'business_endpoint', event: 'booking.created', businessId: 'nonexistent', payload: { a: 1 } },
      { kind: 'oauth_clients', userId: 'nonexistent', event: 'booking.created', payload: { a: 1 } },
    ];

    for (const job of jobs) {
      // A business with no endpoints resolves to zero deliveries rather than
      // throwing; this asserts the dispatch path is safe with no subscribers.
      await expect(runWebhookJob(job)).resolves.toBeUndefined();
    }
  });
});

describe('closeQueues', () => {
  it('is safe to call when nothing was ever queued', async () => {
    await expect(closeQueues()).resolves.toBeUndefined();
  });
});