"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const admin = __importStar(require("firebase-admin"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const ai_service_1 = require("./ai.service");
const openwa_after_hours_service_1 = require("./openwa.after-hours.service");
const openwa_template_service_1 = require("./openwa.template.service");
// Use globally initialized admin from utils/firebase.ts
const isFirebaseInitialized = () => admin.apps.length > 0;
// Initialize strict Gmail Email transporter
const emailTransporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
class NotificationService {
    /**
     * Send Firebase Cloud Messaging Push Notification for reservation
     */
    async sendPushNotification(fcmToken, reservation) {
        try {
            if (!isFirebaseInitialized() || !fcmToken) {
                logger_1.logger.warn('Cannot send Push Notification: Missing Firebase setup or FCM Token.');
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
            logger_1.logger.info(`Push notification sent successfully to FCM token ${fcmToken.substring(0, 10)}...`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send Push Notification', error);
            return false;
        }
    }
    /**
     * Send email reminder for reservation via Gmail SMTP
     */
    async sendEmailReminder(email, reservation) {
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
            logger_1.logger.info(`Email reminder sent via Gmail to ${email}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send email reminder via Gmail', error);
            return false;
        }
    }
    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, resetUrl, firstName) {
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
            logger_1.logger.info(`Password reset email sent to ${email}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send password reset email', error);
            return false;
        }
    }
    /**
     * Send confirmation notification when reservation is created
     */
    async sendConfirmation(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: {
                    business: {
                        include: { settings: true },
                    },
                    customer: true,
                },
            });
            if (!reservation) {
                logger_1.logger.warn(`Reservation ${reservationId} not found for confirmation`);
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
                const afterHours = openwa_after_hours_service_1.openwaAfterHoursService.isAfterHoursNow({
                    id: reservation.business.id,
                    timezone: reservation.business.timezone,
                    settings: reservation.business.settings || null,
                });
                if (afterHours) {
                    await (0, ai_service_1.sendWhatsAppMessage)(reservation.customerPhone, openwa_after_hours_service_1.openwaAfterHoursService.getAwayMessage({
                        id: reservation.business.id,
                        timezone: reservation.business.timezone,
                        settings: reservation.business.settings || null,
                    }));
                }
                else {
                    await openwa_template_service_1.openwaTemplateService.sendTemplate(reservation.customerPhone, 'booking_confirmation', {
                        customerName: reservation.customerName,
                        businessName: reservation.business.name,
                        reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
                        reservationTime: reservation.reservationTime,
                        guestCount: (reservation.numberOfGuests || 1).toString(),
                    });
                }
            }
            // Log notification
            await database_1.prisma.notificationLog.create({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to send confirmation', error);
        }
    }
    /**
     * Schedule reminder for reservation (should be called by a cron job)
     */
    async sendReminder(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
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
            // Track A: A/B test on timing (24h vs 1h before)
            // Deterministic A/B assignment based on the last character of reservation ID
            const lastChar = reservationId.charAt(reservationId.length - 1);
            const isOneHourCohort = /[0-7a-m]/i.test(lastChar); // ~50% split
            const reminderHours = isOneHourCohort ? 1 : 24;
            const reservationDate = new Date(reservation.reservationDate);
            const reminderTime = new Date(reservationDate.getTime() - reminderHours * 60 * 60 * 1000);
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
                    const afterHours = openwa_after_hours_service_1.openwaAfterHoursService.isAfterHoursNow({
                        id: reservation.business.id,
                        timezone: reservation.business.timezone,
                        settings: reservation.business.settings || null,
                    });
                    if (afterHours) {
                        await (0, ai_service_1.sendWhatsAppMessage)(reservation.customerPhone, openwa_after_hours_service_1.openwaAfterHoursService.getAwayMessage({
                            id: reservation.business.id,
                            timezone: reservation.business.timezone,
                            settings: reservation.business.settings || null,
                        }));
                    }
                    else {
                        await openwa_template_service_1.openwaTemplateService.sendTemplate(reservation.customerPhone, 'booking_reminder', {
                            customerName: reservation.customerName,
                            businessName: reservation.business.name,
                            reservationDate: reservationDate.toLocaleDateString(),
                            reservationTime: reservation.reservationTime,
                        });
                    }
                }
                await database_1.prisma.reservation.update({
                    where: { id: reservationId },
                    data: { reminderSentAt: new Date() },
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send reminder', error);
        }
    }
    /**
     * Send WhatsApp notification to business owner on new booking
     */
    async sendBusinessNotification(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: {
                    business: {
                        include: { settings: true },
                    },
                },
            });
            if (!reservation)
                return;
            const settings = reservation.business.settings;
            if (settings?.notifyOwnerOnNewBooking && settings?.whatsappNumber) {
                const dashboardUrl = `${process.env.FRONTEND_URL || 'https://pabandi.com'}/business/dashboard`;
                await openwa_template_service_1.openwaTemplateService.sendTemplate(settings.whatsappNumber, 'new_booking_alert', {
                    businessName: reservation.business.name,
                    customerName: reservation.customerName,
                    reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
                    reservationTime: reservation.reservationTime,
                    guestCount: (reservation.numberOfGuests || 1).toString(),
                    customerPhone: reservation.customerPhone || 'N/A',
                    dashboardUrl,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send business notification', error);
        }
    }
    /**
     * Send WhatsApp review request after completion
     */
    async sendReviewRequest(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: {
                    business: {
                        include: { settings: true },
                    },
                },
            });
            if (!reservation)
                return;
            const settings = reservation.business.settings;
            if (settings?.requestFeedbackAfterBooking && reservation.customerPhone) {
                const reviewUrl = `${process.env.FRONTEND_URL || 'https://pabandi.com'}/b/${reservation.business.id}/review`;
                await openwa_template_service_1.openwaTemplateService.sendTemplate(reservation.customerPhone, 'review_request', {
                    customerName: reservation.customerName,
                    businessName: reservation.business.name,
                    reviewUrl,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send review request', error);
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map