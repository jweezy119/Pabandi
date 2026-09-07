import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const FROM_EMAIL = 'jay@pabandi.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ═══════════════════════════════════════════════════════════════════════════
// Legacy exports (backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendVerificationEmail(to: string, code: string, firstName: string): Promise<boolean> {
  const subject = 'Verify your Pabandi account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; font-size: 28px; margin: 0;">🛡️ Pabandi</h1>
      </div>
      <div style="background: #f9fafb; border-radius: 12px; padding: 30px; text-align: center;">
        <h2 style="color: #1f2937; margin: 0 0 10px;">Welcome, ${firstName}!</h2>
        <p style="color: #6b7280; margin: 0 0 25px;">Use this code to verify your email address:</p>
        <div style="background: white; border: 2px dashed #6366f1; border-radius: 8px; padding: 15px; margin: 0 0 25px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">This code expires in 15 minutes.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
        If you didn't create a Pabandi account, you can safely ignore this email.
      </p>
    </div>
  `;

  const result = await emailService.sendEmail(to, subject, html, 'VERIFICATION');
  return result.status === 'SENT' || result.status === 'LOGGED';
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ═══════════════════════════════════════════════════════════════════════════
// Email Service (new nightlife booking functions)
// ═══════════════════════════════════════════════════════════════════════════

export const emailService = {
  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(booking: any) {
    const { user, venue, tableType, bottlePackage } = booking;

    const subject = `🍾 Booking Confirmed - ${venue?.name || 'Venue'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1; margin-bottom: 20px;">🛡️ Pabandi</h1>
        <h2 style="color: #1f2937;">Booking Confirmed!</h2>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p><strong>Confirmation Code:</strong> ${booking.confirmationCode}</p>
          <p><strong>Venue:</strong> ${venue?.name || 'N/A'}</p>
          <p><strong>Date:</strong> ${new Date(booking.date).toLocaleDateString()}</p>
          <p><strong>Arrival Time:</strong> ${booking.arrivalTime}</p>
          <p><strong>Table:</strong> ${tableType?.name || 'N/A'}</p>
          <p><strong>Bottle Package:</strong> ${bottlePackage?.name || 'N/A'}</p>
          <p><strong>Guests:</strong> ${booking.guestCount}</p>
          <p><strong>Total Price:</strong> $${booking.totalPrice?.toFixed(2)}</p>
          ${booking.specialRequests ? `<p><strong>Special Requests:</strong> ${booking.specialRequests}</p>` : ''}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Present this confirmation at the venue entrance.</p>
      </div>
    `;

    await this.sendEmail(user?.email, subject, html, 'BOOKING_CONFIRMATION');
  },

  /**
   * Send guest list confirmation email
   */
  async sendGuestListConfirmation(entry: any) {
    const { venue, email } = entry;

    const subject = `✅ Guest List Confirmed - ${venue?.name || 'Venue'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1; margin-bottom: 20px;">🛡️ Pabandi</h1>
        <h2 style="color: #1f2937;">You're on the Guest List!</h2>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p><strong>Confirmation Code:</strong> ${entry.confirmationCode}</p>
          <p><strong>Venue:</strong> ${venue?.name || 'N/A'}</p>
          <p><strong>Date:</strong> ${new Date(entry.date).toLocaleDateString()}</p>
          <p><strong>Party Size:</strong> ${entry.partySize}</p>
          <p><strong>Guests:</strong> ${entry.guestNames?.join(', ') || 'N/A'}</p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Show this confirmation at the door for priority entry.</p>
      </div>
    `;

    const toEmail = email || entry.userId;
    await this.sendEmail(toEmail, subject, html, 'GUEST_LIST_CONFIRMATION');
  },

  /**
   * Send promoter commission notification
   */
  async sendPromoterCommissionNotification(promoter: any, amount: number, bookingId: string) {
    const subject = `💰 Commission Earned - $${amount.toFixed(2)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1; margin-bottom: 20px;">🛡️ Pabandi</h1>
        <h2 style="color: #1f2937;">Commission Earned!</h2>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p style="color: #6b7280; font-size: 14px;">Keep up the great work! Your commission has been credited to your wallet.</p>
        </div>
      </div>
    `;

    // Use promoter's userId to find email
    const user = await prisma.user.findUnique({
      where: { id: promoter.userId },
      select: { email: true },
    });

    if (user?.email) {
      await this.sendEmail(user.email, subject, html, 'PROMOTER_COMMISSION');
    }
  },

  /**
   * Core email sending function
   * Uses Resend if API key is set, otherwise logs to console
   */
  async sendEmail(to: string, subject: string, html: string, type: string) {
    let status = 'PENDING';
    let errorMessage: string | null = null;

    try {
      if (RESEND_API_KEY) {
        // Lazy-load Resend
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);

        await resend.emails.send({
          from: `Pabandi <${FROM_EMAIL}>`,
          to,
          subject,
          html,
        });

        status = 'SENT';
        logger.info(`[email] ${type} sent to ${to}`);
      } else {
        // Log to console if Resend not configured
        logger.info(`[email] RESEND_API_KEY not set — logging email instead`);
        logger.info(`[email] TO: ${to}`);
        logger.info(`[email] SUBJECT: ${subject}`);
        logger.info(`[email] TYPE: ${type}`);
        status = 'LOGGED';
      }
    } catch (err: any) {
      status = 'FAILED';
      errorMessage = err.message;
      logger.error(`[email] Failed to send ${type} to ${to}: ${err.message}`);
    }

    // Create EmailLog record
    try {
      await prisma.emailLog.create({
        data: {
          toEmail: to,
          subject,
          body: html.substring(0, 1000), // Truncate for storage
          type,
          status,
          errorMessage,
        },
      });
    } catch (logErr: any) {
      logger.error(`[email] Failed to create email log: ${logErr.message}`);
    }

    return { status, errorMessage };
  },
};
