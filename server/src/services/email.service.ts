import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Resend } from 'resend';
import { clampReliabilityScore } from '../config/trust-weights';

// Constructed lazily: `new Resend('')` throws, and this module is imported
// during server boot, so an unset RESEND_API_KEY used to take the whole API
// down instead of just failing sends.
let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY || '');
  return client;
}
const FROM = process.env.EMAIL_FROM || 'noreply@pabandi.com';

/**
 * Args for sendEmail. Explicit because every one of these was implicitly `any`,
 * which also made `err.message` on the catch below an error: on a strict config
 * `err` is `unknown` and has no `message`.
 */
export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] no API key, skipping send to', to);
    return { skipped: true };
  }
  try {
    const result = await getClient().emails.send({ from: FROM, to, subject, html });
    console.log('[email] sent', result.id);
    return result;
  } catch (err) {
    // Log the provider's own message. Resend's most common rejection here is an
    // unverified `from` domain, and "Failed to send code. Please try again." with
    // nothing behind it is undiagnosable from the outside — the customer retries,
    // the operator has no idea why, and the feature stays broken.
    const resendDetail =
      (err as { data?: { message?: string }; message?: string })?.data?.message ??
      (err as { message?: string })?.message ??
      String(err);
    console.error(`[email] failed for ${to} from ${FROM}: ${resendDetail}`);
    // err is unknown, so it has no `.message`. Reading one off it was the second
    // error in this function, and it would have thrown inside the catch — turning
    // a failed send into an unhandled rejection.
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../templates/emails');

/**
 * A reliability score for a customer-facing template, or `null` if there is none.
 *
 * Returns a string because the templates interpolate into HTML — the score is
 * shown as "72/100", and the "/100" is in the template, not here, so the two
 * cannot drift apart.
 *
 * Deliberately NOT `score || ''`. That idiom hides a legitimate 0, which is the
 * score belonging to exactly the customer who most needs to see it on their
 * invoice and most needs to be able to contest it.
 */
function formatScore(raw: number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  return String(Math.round(clampReliabilityScore(raw)));
}

function renderTemplate(templateName: string, data: Record<string, string>) {
  let base = '';
  try {
    base = fs.readFileSync(path.join(TEMPLATE_DIR, 'base.html'), 'utf-8');
  } catch {
    base = '<!DOCTYPE html><html><body>{{content}}</body></html>';
  }

  let content = '';
  try {
    content = fs.readFileSync(path.join(TEMPLATE_DIR, `${templateName}.html`), 'utf-8');
  } catch {
    content = JSON.stringify(data);
  }

  let rendered = content;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }

  return base.replace('{{content}}', rendered);
}

export const emailService = {
  async sendBookingConfirmation(data: { to: string; businessName: string; date: string; time: string; guests: number; confirmationCode?: string }) {
    const html = renderTemplate('booking-confirmed', {
      businessName: data.businessName,
      date: data.date,
      time: data.time,
      guests: String(data.guests),
      confirmationCode: data.confirmationCode || '',
      clientName: data.to,
    });
    return sendEmail({ to: data.to, subject: `Booking confirmed: ${data.businessName}`, html });
  },

  async sendBookingReminder(data: { to: string; businessName: string; date: string; time: string; guests: number; confirmationCode?: string }) {
    const html = renderTemplate('booking-reminder', {
      businessName: data.businessName,
      date: data.date,
      time: data.time,
      guests: String(data.guests),
      confirmationCode: data.confirmationCode || '',
      clientName: data.to,
    });
    return sendEmail({ to: data.to, subject: `Reminder: Your booking at ${data.businessName} tomorrow`, html });
  },

  async sendInvoiceSent(client: any, invoice: any, business: any) {
    const html = renderTemplate('invoice-sent', {
      businessName: business.name,
      clientName: client.name,
      amount: String(invoice.subtotal),
      invoiceNumber: invoice.number,
      dueDate: new Date(invoice.dateDue).toLocaleDateString(),
      payUrl: `${process.env.APP_URL || 'http://localhost:5173'}/pay/${invoice.id}`,
      // `|| null` also swallowed a legitimate 0, hiding the score from a
      // customer whose score is genuinely at the floor — i.e. exactly the person
      // who most needs to see it, and most needs to be able to contest it. Now
      // only an absent value is absent.
      trustScore: formatScore(client.reliabilityScore),
    });
    return sendEmail({ to: client.email, subject: `Invoice ${invoice.number} from ${business.name}`, html });
  },

  async sendInvoiceReminder(client: any, invoice: any, business: any) {
    const html = renderTemplate('invoice-reminder', {
      businessName: business.name,
      clientName: client.name,
      amount: String(invoice.subtotal),
      invoiceNumber: invoice.number,
      dueDate: new Date(invoice.dateDue).toLocaleDateString(),
      payUrl: `${process.env.APP_URL || 'http://localhost:5173'}/pay/${invoice.id}`
    });
    return sendEmail({ to: client.email, subject: `Reminder: Invoice ${invoice.number} is due`, html });
  },

  async sendPaymentReceived(business: any, invoice: any, client: any) {
    const html = renderTemplate('payment-received', {
      businessName: business.name,
      clientName: client.name,
      amount: String(invoice.subtotal),
      invoiceNumber: invoice.number,
      clientTrustScore: formatScore(client.reliabilityScore),
    });
    return sendEmail({ to: business.email || 'business@example.com', subject: `Payment Received: Invoice ${invoice.number}`, html });
  },

  /**
   * The client-side half of failure ownership: "Payment didn't arrive —
   * here's the link". Sent once an invoice is past the grace period and still
   * unpaid, so the client learns the payment has not landed rather than
   * assuming it did.
   */
  async sendPaymentDidntArrive(client: any, invoice: any, business: any, daysPastDue: number) {
    if (!client?.email) return { skipped: true, reason: 'client has no email' };
    const currency = business?.currency || 'USD';
    const html = renderTemplate('payment-didnt-arrive', {
      businessName: business?.name || 'Your service provider',
      clientName: client.name,
      invoiceNumber: invoice.number,
      amount: String(invoice.subtotal),
      currency,
      dueDate: new Date(invoice.dateDue).toLocaleDateString(),
      daysPastDue: String(daysPastDue),
      payUrl: `${process.env.APP_URL || 'http://localhost:5173'}/pay/${invoice.id}`,
    });
    return sendEmail({
      to: client.email,
      subject: `Payment didn't arrive — ${invoice.number} from ${business?.name || 'your provider'}`,
      html,
    });
  },

  /** Both parties are notified when a dispute case opens. */
  async sendDisputeOpened(party: any, invoice: any, business: any, disputeId: string, reason?: string) {
    if (!party?.email) return { skipped: true, reason: 'party has no email' };
    const html = renderTemplate('dispute-opened', {
      partyName: party.name,
      businessName: business?.name || '',
      invoiceNumber: invoice.number,
      amount: String(invoice.subtotal),
      currency: business?.currency || 'USD',
      dueDate: new Date(invoice.dateDue).toLocaleDateString(),
      reason: reason || 'A case has been opened to review this invoice.',
      disputeId,
      caseUrl: `${process.env.APP_URL || 'http://localhost:5173'}/contact/invoices/${invoice.id}`,
    });
    return sendEmail({
      to: party.email,
      subject: `Dispute opened on ${invoice.number}`,
      html,
    });
  },

  async sendPaymentClaimed(business: any, invoice: any, client: any) {
    const html = renderTemplate('payment-claimed', {
      businessName: business.name,
      clientName: client.name,
      amount: String(invoice.subtotal),
      invoiceNumber: invoice.number,
      verifyUrl: `${process.env.APP_URL || 'http://localhost:5173'}/contact/invoices`
    });
    return sendEmail({ to: business.email || 'business@example.com', subject: `Client Claims Paid: Verify Invoice ${invoice.number}`, html });
  },

  /**
   * Confirmation for an entry added to a venue's guest list.
   *
   * Called by guestListService after every add. It was calling a method that did
   * not exist, so every guest-list confirmation threw a TypeError — caught and
   * logged as a warning by the caller, which is why it presented as "emails just
   * sometimes don't arrive" rather than as an error.
   *
   * The template is `guest-list-confirmed`, added alongside. Without it
   * renderTemplate silently falls back to dumping the data object as JSON into
   * the email body, so the previous state would have been a broken-looking email
   * even once the method existed.
   *
   * Every field is read defensively: the entry is a Prisma row with an optional
   * email, optional venue relation and optional guestNames, and this must not be
   * the thing that throws when any of those are absent.
   */
  async sendGuestListConfirmation(entry: any) {
    const to = entry?.email;
    if (!to) return { skipped: true };

    const guestNames = Array.isArray(entry.guestNames) ? entry.guestNames : [];
    const html = renderTemplate('guest-list-confirmed', {
      clientName: guestNames[0] || 'there',
      venueName: entry.venue?.name || 'the venue',
      venueAddress: entry.venue?.address || '',
      confirmationCode: entry.confirmationCode || '',
      date: entry.date ? new Date(entry.date).toLocaleDateString() : '',
      partySize: String(entry.partySize ?? ''),
      guestNames: guestNames.join(', '),
    });
    return sendEmail({
      to,
      subject: `Guest list confirmed: ${entry.venue?.name || 'your venue'}`,
      html,
    });
  },

  /**
   * Email a login/verification code.
   *
   * This method DID NOT EXIST. auth.controller called it via
   * `const { sendVerificationEmail } = require('../services/email.service')` and
   * every "sign in with email code" attempt returned
   * `{"success":false,"message":"sendCode is not a function"}`. The account was
   * created and the code written to the database first, so the flow looked almost
   * correct right up to the send — which is why it read as "email login is flaky"
   * rather than "it has never worked".
   *
   * Returns whether a message actually went out. `sendEmail` returns
   * `{ skipped: true }` when no provider is configured and `{ error }` on a
   * provider failure, so a truthy return here genuinely means SENT — the caller
   * branches on 503 vs 500 and cannot tell them apart otherwise.
   */
  async sendVerificationEmail(email: string, code: string, firstName?: string) {
    const html = renderTemplate('verification-code', {
      firstName: firstName || 'there',
      code,
      // Minutes, not a duration string: the template shows "expires in 15 minutes"
      // and the controller decides the real expiry window.
      expiryMinutes: '15',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@pabandi.com',
    });
    const result = await sendEmail({
      to: email,
      subject: `${code} is your Pabandi code`,
      html,
    });
    if (result && typeof result === 'object' && ('skipped' in result || 'error' in result)) {
      return null;
    }
    return result;
  },

  async sendWelcome(user: any) {
    const html = renderTemplate('welcome', {
      userName: user.name || 'there',
    });
    return sendEmail({ to: user.email, subject: 'Welcome to Pabandi', html });
  },

  async sendTrustScoreChanged(user: any, field: string, oldScore: number, newScore: number) {
    const html = renderTemplate('trust-score-changed', {
      userName: user.name || 'there',
      field,
      oldScore: String(oldScore),
      newScore: String(newScore),
      change: newScore > oldScore ? `increased by ${newScore - oldScore}` : `decreased by ${oldScore - newScore}`,
      profileUrl: `${process.env.APP_URL || 'http://localhost:5173'}/contact/settings/profile`
    });
    return sendEmail({ to: user.email, subject: 'Your Trust Score updated', html });
  },
};
