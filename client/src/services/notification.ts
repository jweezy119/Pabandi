import { notificationsService } from './api';

export interface Notification {
  id: string;
  type: 'booking' | 'dispute' | 'escrow' | 'review';
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

export class NotificationService {
  /**
   * Fetch notifications for the current user.
   */
  async getNotifications(email: string, limit = 20): Promise<Notification[]> {
    const res = await notificationsService.getNotifications(email, limit);
    return (res?.data?.data ?? []) as Notification[];
  }

  /**
   * Mark notifications as read.
   */
  async markRead(ids: string[]): Promise<void> {
    await notificationsService.markRead(ids);
  }

  /**
   * Trigger a reservation confirmation email + push notification.
   * Server-side automation handles the actual delivery.
   */
  async triggerReservationConfirmation(reservationId: string): Promise<void> {
    await fetch(`/api/v1/notifications/confirm/${reservationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }

  /**
   * Trigger a reservation reminder email + push notification.
   * Server-side automation handles the actual delivery.
   */
  async triggerReservationReminder(reservationId: string): Promise<void> {
    await fetch(`/api/v1/notifications/remind/${reservationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }

  /**
   * Trigger a review request SMS/WhatsApp after booking completion.
   * Server-side automation handles the actual delivery.
   */
  async triggerReviewRequest(reservationId: string): Promise<void> {
    await fetch(`/api/v1/notifications/review/${reservationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }

  /**
   * Send a generic email notification via server-side Nodemailer.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      await fetch('/api/v1/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send an SMS via server-side Twilio or OpenWA fallback.
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      await fetch('/api/v1/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const notificationService = new NotificationService();
