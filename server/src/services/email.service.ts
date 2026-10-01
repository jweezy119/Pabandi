import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Resend } from 'resend';

// Constructed lazily: `new Resend('')` throws, and this module is imported
// during server boot, so an unset RESEND_API_KEY used to take the whole API
// down instead of just failing sends.
let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY || '');
  return client;
}
const FROM = process.env.EMAIL_FROM || 'noreply@pabandi.com';

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] no API key, skipping send to', to);
    return { skipped: true };
  }
  try {
    const result = await getClient().emails.send({ from: FROM, to, subject, html });
    console.log('[email] sent', result.id);
    return result;
  } catch (err) {
    console.error('[email] failed', err);
    return { error: err.message };
  }
}

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../templates/emails');

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
      trustScore: client.reliabilityScore || null,
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
      clientTrustScore: client.reliabilityScore || null,
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
