import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { sendWhatsAppMessage } from './ai.service';

// Use globally initialized admin from utils/firebase.ts
const isFirebaseInitialized = () => admin.apps.length > 0;

// Initialize strict Gmail Email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export class NotificationService {
  /**
   * Send Firebase Cloud Messaging Push Notification for reservation
   */
  async sendPushNotification(
    fcmToken: string,
    reservation: {
      businessName: string;
      reservationDate: string;
      reservationTime: string;
      customerName: string;
    }
  ): Promise<boolean> {
    try {
      if (!isFirebaseInitialized() || !fcmToken) {
        logger.warn('Cannot send Push Notification: Missing Firebase setup or FCM Token.');
        return false;
      }

      const payload = {
        token: fcmToken,
        notification: {
          title: `Reservation at ${reservation.businessName}`,
          body: `Hello ${reservation.customerName}, your reservation on ${reservation.reservationDate} at ${reservation.reservationTime} is coming up!`,
        },
        data: {
          type: 'RESERVATION_REMINDER',
        }
      };

      await admin.messaging().send(payload);
      logger.info(`Push notification sent successfully to FCM token ${fcmToken.substring(0, 10)}...`);
      return true;
    } catch (error) {
      logger.error('Failed to send Push Notification', error);
      return false;
    }
  }

  /**
   * Send email reminder for reservation via Gmail SMTP
   */
  async sendEmailReminder(
    email: string,
    reservation: {
      businessName: string;
      reservationDate: string;
      reservationTime: string;
      customerName: string;
      businessAddress: string;
    }
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@pabandi.com',
        to: email,
        subject: `Reminder: Reservation at ${reservation.businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reservation Reminder</h2>
            <p>Hello ${reservation.customerName},</p>
            <p>This is a friendly reminder about your upcoming reservation:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Business:</strong> ${reservation.businessName}</p>
              <p><strong>Address:</strong> ${reservation.businessAddress}</p>
              <p><strong>Date:</strong> ${reservation.reservationDate}</p>
              <p><strong>Time:</strong> ${reservation.reservationTime}</p>
            </div>
            <p>We look forward to seeing you!</p>
            <p>If you need to cancel or modify your reservation, please contact the business directly.</p>
          </div>
        `,
      };

      await emailTransporter.sendMail(mailOptions);
      logger.info(`Email reminder sent via Gmail to ${email}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email reminder via Gmail', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    firstName: string
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@pabandi.pk',
        to: email,
        subject: 'Reset Your Pabandi Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>Hello ${firstName},</p>
            <p>We received a request to reset the password for your Pabandi account. Click the button below to choose a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #777;">&copy; 2026 Pabandi &middot; United States</p>
          </div>
        `,
      };

      await emailTransporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      logger.error('Failed to send password reset email', error);
      return false;
    }
  }

  /**
   * Send confirmation notification when reservation is created
   */
  async sendConfirmation(reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          business: {
            include: { settings: true },
          },
          customer: true,
        },
      });

      if (!reservation) {
        logger.warn(`Reservation ${reservationId} not found for confirmation`);
        return;
      }

      // Send email confirmation
      if (reservation.customerEmail) {
        await this.sendEmailReminder(reservation.customerEmail, {
          businessName: reservation.business.name,
          reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
          reservationTime: reservation.reservationTime,
          customerName: reservation.customerName,
          businessAddress: reservation.business.address,
        });
      }

      // Send FCM Push notification instead of SMS
      const fcmToken = reservation.customer?.fcmToken;
      if (fcmToken) {
        await this.sendPushNotification(fcmToken, {
          businessName: reservation.business.name,
          reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
          reservationTime: reservation.reservationTime,
          customerName: reservation.customerName,
        });
      }

      // Send WhatsApp confirmation
      if (reservation.business.settings?.sendWhatsAppReminders && reservation.customerPhone) {
        const msg = `Hi ${reservation.customerName}! Your reservation at *${reservation.business.name}* is CONFIRMED for ${new Date(reservation.reservationDate).toLocaleDateString()} at ${reservation.reservationTime}. We look forward to seeing you!`;
        await sendWhatsAppMessage(reservation.customerPhone, msg);
      }

      // Log notification
      await prisma.notificationLog.create({
        data: {
          reservationId,
          type: 'email_and_push',
          recipient: reservation.customerEmail || 'FCM Device',
          subject: `Reservation Confirmed at ${reservation.business.name}`,
          message: 'Reservation confirmation dispatched',
          status: 'sent',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to send confirmation', error);
    }
  }

  /**
   * Schedule reminder for reservation (should be called by a cron job)
   */
  async sendReminder(reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          business: {
            include: {
              settings: true,
            },
          },
          customer: true,
        },
      });

      if (!reservation || reservation.status !== 'CONFIRMED') {
        return;
      }

      const settings = reservation.business.settings;
      const reminderHours = settings?.reminderHoursBefore || 24;

      const reservationDate = new Date(reservation.reservationDate);
      const reminderTime = new Date(
        reservationDate.getTime() - reminderHours * 60 * 60 * 1000
      );

      if (new Date() >= reminderTime && !reservation.reminderSentAt) {
        // Send email reminders
        if (settings?.sendEmailReminders && reservation.customerEmail) {
          await this.sendEmailReminder(reservation.customerEmail, {
            businessName: reservation.business.name,
            reservationDate: reservationDate.toLocaleDateString(),
            reservationTime: reservation.reservationTime,
            customerName: reservation.customerName,
            businessAddress: reservation.business.address,
          });
        }

        // Send Push reminders
        const pushToken = reservation.customer?.fcmToken;
        if (settings?.sendPushReminders && pushToken) {
          await this.sendPushNotification(pushToken, {
            businessName: reservation.business.name,
            reservationDate: reservationDate.toLocaleDateString(),
            reservationTime: reservation.reservationTime,
            customerName: reservation.customerName,
          });
        }

        // Send WhatsApp Reminder
        if (settings?.sendWhatsAppReminders && reservation.customerPhone) {
          const msg = `Reminder: Hi ${reservation.customerName}, your reservation at *${reservation.business.name}* is coming up on ${reservationDate.toLocaleDateString()} at ${reservation.reservationTime}.`;
          await sendWhatsAppMessage(reservation.customerPhone, msg);
        }

        await prisma.reservation.update({
          where: { id: reservationId },
          data: { reminderSentAt: new Date() },
        });
      }
    } catch (error) {
      logger.error('Failed to send reminder', error);
    }
  }
  /**
   * Send WhatsApp notification to business owner on new booking
   */
  async sendBusinessNotification(reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          business: {
            include: { settings: true },
          },
        },
      });

      if (!reservation) return;

      const settings = reservation.business.settings;
      if (settings?.notifyOwnerOnNewBooking && settings?.whatsappNumber) {
        const msg = `🔔 *New Booking Alert*\n\nYou have a new reservation at *${reservation.business.name}*!\n\nName: ${reservation.customerName}\nDate: ${new Date(reservation.reservationDate).toLocaleDateString()}\nTime: ${reservation.reservationTime}\nGuests: ${reservation.numberOfGuests}\nPhone: ${reservation.customerPhone}`;
        await sendWhatsAppMessage(settings.whatsappNumber, msg);
      }
    } catch (error) {
      logger.error('Failed to send business notification', error);
    }
  }

  /**
   * Send WhatsApp review request after completion
   */
  async sendReviewRequest(reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          business: {
            include: { settings: true },
          },
        },
      });

      if (!reservation) return;

      const settings = reservation.business.settings;
      if (settings?.requestFeedbackAfterBooking && reservation.customerPhone) {
        const msg = `Hi ${reservation.customerName}! Thank you for visiting *${reservation.business.name}*. We hope you had a great experience! Please let us know how we did by leaving a review on our Pabandi page. Your feedback helps us improve!`;
        await sendWhatsAppMessage(reservation.customerPhone, msg);
      }
    } catch (error) {
      logger.error('Failed to send review request', error);
    }
  }
}

export const notificationService = new NotificationService();
