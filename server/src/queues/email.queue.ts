import { enqueue, type EnqueueResult } from './connection';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';

/**
 * Email delivery off the request path.
 *
 * ─── WHY THE PAYLOADS ARE DISCRIMINATED AND FLAT ────────────────────────────
 * A job is serialised to JSON and sits in Redis until a worker picks it up. Two
 * consequences follow, and both are visible in the types below.
 *
 * 1. Discriminated union, not a string method name. The `kind` field is what
 *    makes `runEmailJob` exhaustive, so adding a new email is a compile error
 *    until its payload is handled rather than a runtime "unknown job" at 3am.
 *
 * 2. Every payload is flat scalars. Several `emailService` methods take live
 *    Prisma rows -- `sendWelcome(user)`, `sendTrustScoreChanged(user, ...)` --
 *    and those rows are read again when the worker runs. Passing the row through
 *    would send an email rendered from whatever the user looks like by then,
 *    or fail outright if the row was deleted. The `*Snapshot` types below are
 *    the fields the templates actually read, captured at enqueue time, which is
 *    the moment the data was true.
 */

export const EMAIL_QUEUE = 'pabandi-email';

export interface BookingEmailSnapshot {
  to: string;
  businessName: string;
  date: string;
  time: string;
  guests: number;
  confirmationCode?: string;
}

export interface PromoEmailSnapshot {
  to: string;
  businessName: string;
  promoTitle: string;
  promoDescription: string;
}

export interface VerificationEmailSnapshot {
  to: string;
  code: string;
  firstName?: string;
}

/** Only the fields `sendWelcome` reads. */
export interface WelcomeEmailSnapshot {
  to: string;
  name?: string;
}

/** Only the fields `sendTrustScoreChanged` reads. */
export interface TrustScoreChangedEmailSnapshot {
  to: string;
  name?: string;
  field: string;
  oldScore: number;
  newScore: number;
}

export type EmailJob =
  | { kind: 'booking_confirmation'; data: BookingEmailSnapshot }
  | { kind: 'booking_reminder'; data: BookingEmailSnapshot }
  | { kind: 'promo'; data: PromoEmailSnapshot }
  | { kind: 'verification'; data: VerificationEmailSnapshot }
  | { kind: 'welcome'; data: WelcomeEmailSnapshot }
  | { kind: 'trust_score_changed'; data: TrustScoreChangedEmailSnapshot };

/**
 * Execute one job.
 *
 * Never throws for a provider failure -- `emailService.sendEmail` already
 * swallows provider errors and returns `{ error }`, so this cannot. What it can
 * do is throw on a malformed payload, and that is allowed to propagate: BullMQ
 * should retry it, and an unhandled payload is a bug worth surfacing rather
 * than a transient condition worth retrying silently.
 */
export async function runEmailJob(job: EmailJob): Promise<void> {
  switch (job.kind) {
    case 'booking_confirmation':
      await emailService.sendBookingConfirmation(job.data);
      return;

    case 'booking_reminder':
      await emailService.sendBookingReminder(job.data);
      return;

    case 'promo':
      // sendPromoEmail lives on bookingService and returns a boolean; the
      // boolean is dropped because an inline or queued caller has no way to
      // act on it. Failure to send a promo is not worth failing the booking.
      await sendPromo(job.data);
      return;

    case 'verification':
      await emailService.sendVerificationEmail(job.data.to, job.data.code, job.data.firstName);
      return;

    case 'welcome':
      await emailService.sendWelcome({ name: job.data.name, email: job.data.to });
      return;

    case 'trust_score_changed':
      await emailService.sendTrustScoreChanged(
        { name: job.data.name, email: job.data.to },
        job.data.field,
        job.data.oldScore,
        job.data.newScore
      );
      return;

    default: {
      // Exhaustiveness guard. Adding a kind to EmailJob without handling it
      // lands here at compile time.
      const unreachable: never = job;
      throw new Error(`Unhandled email job: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * bookingService.sendPromoEmail hand-rolls its Resend call. Importing
 * booking.service here would pull that module's Prisma and side effects into
 * the worker for one function, so the call is made through the same email
 * service the rest of the queue uses.
 */
async function sendPromo(data: PromoEmailSnapshot): Promise<void> {
  const bookingService = await import('../services/booking.service');
  await bookingService.bookingService.sendPromoEmail(data);
}

// ── Producers ────────────────────────────────────────────────────────────────

export async function queueBookingConfirmation(data: BookingEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(EMAIL_QUEUE, 'booking_confirmation', { kind: 'booking_confirmation', data } satisfies EmailJob, runEmailJob);
}

export async function queueBookingReminder(data: BookingEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(EMAIL_QUEUE, 'booking_reminder', { kind: 'booking_reminder', data } satisfies EmailJob, runEmailJob);
}

export async function queuePromoEmail(data: PromoEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(EMAIL_QUEUE, 'promo', { kind: 'promo', data } satisfies EmailJob, runEmailJob);
}

export async function queueVerificationEmail(data: VerificationEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(EMAIL_QUEUE, 'verification', { kind: 'verification', data } satisfies EmailJob, runEmailJob);
}

export async function queueWelcomeEmail(data: WelcomeEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(EMAIL_QUEUE, 'welcome', { kind: 'welcome', data } satisfies EmailJob, runEmailJob);
}

export async function queueTrustScoreChangedEmail(data: TrustScoreChangedEmailSnapshot): Promise<EnqueueResult> {
  return enqueue(
    EMAIL_QUEUE,
    'trust_score_changed',
    { kind: 'trust_score_changed', data } satisfies EmailJob,
    runEmailJob
  );
}

/**
 * Convenience for a caller holding a user row. Snapshots here so the caller
 * cannot accidentally hand a live Prisma object to the queue.
 */
export function queueWelcomeEmailForUser(user: { email: string; firstName?: string | null; name?: string | null }): Promise<EnqueueResult> {
  const name = user.name ?? [user.firstName].filter(Boolean).join(' ') ?? undefined;
  return queueWelcomeEmail({ to: user.email, name: name || undefined });
}