import { prisma } from '../utils/database';

export type NotificationType =
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'invoice_payment_retry'
  | 'trust_score_changed'
  | 'job_completed'
  | 'task_due'
  | 'payment_claimed'
  | 'support_reply';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({ data: params });
}

export async function notifyInvoicePaid(businessOwnerId: string, invoiceId: string, invoiceNumber: string, amount: number) {
  return createNotification({
    userId: businessOwnerId,
    type: 'invoice_paid',
    title: `Invoice #${invoiceNumber} paid`,
    body: `Payment of $${amount.toLocaleString()} received`,
    actionUrl: `/invoices/${invoiceId}`,
  });
}

export async function notifyInvoiceOverdue(businessOwnerId: string, invoiceId: string, invoiceNumber: string, amount: number) {
  return createNotification({
    userId: businessOwnerId,
    type: 'invoice_overdue',
    title: `Invoice #${invoiceNumber} is overdue`,
    body: `Payment of $${amount.toLocaleString()} is past due`,
    actionUrl: `/invoices/${invoiceId}`,
  });
}

export async function notifyTrustScoreChanged(userId: string, previousScore: number, newScore: number, change: number) {
  if (Math.abs(change) <= 20) return; // Only notify for changes > 20

  const direction = change > 0 ? 'increased' : 'decreased';
  return createNotification({
    userId,
    type: 'trust_score_changed',
    title: `Trust score ${direction}`,
    body: `Your trust score ${direction} by ${Math.abs(change)} points to ${newScore}`,
    actionUrl: '/trust/passport',
  });
}

export async function notifyJobCompleted(businessOwnerId: string, jobId: string, jobTitle: string) {
  return createNotification({
    userId: businessOwnerId,
    type: 'job_completed',
    title: `Job completed: ${jobTitle}`,
    body: 'A job has been marked as completed',
    actionUrl: `/jobs/${jobId}`,
  });
}

export async function notifyTaskDue(assigneeId: string, taskId: string, taskTitle: string, dueInHours: number) {
  return createNotification({
    userId: assigneeId,
    type: 'task_due',
    title: `Task due soon: ${taskTitle}`,
    body: `This task is due in ${dueInHours} hours`,
    actionUrl: `/tasks/${taskId}`,
  });
}

export async function notifyPaymentClaimed(businessOwnerId: string, invoiceId: string, invoiceNumber: string) {
  return createNotification({
    userId: businessOwnerId,
    type: 'payment_claimed',
    title: `Payment claimed for Invoice #${invoiceNumber}`,
    body: 'Client marked this invoice as paid',
    actionUrl: `/invoices/${invoiceId}`,
  });
}

export async function notifySupportReply(ticketCreatorId: string, ticketId: string, ticketSubject: string) {
  return createNotification({
    userId: ticketCreatorId,
    type: 'support_reply',
    title: `Reply on support ticket: ${ticketSubject}`,
    body: 'A support agent has replied to your ticket',
    actionUrl: `/support/tickets/${ticketId}`,
  });
}

// Legacy notification service compatibility layer
export const notificationService = {
  async sendPasswordResetEmail(email: string, resetUrl: string, firstName: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await createNotification({
        userId: user.id,
        type: 'support_reply',
        title: 'Password Reset Request',
        body: `Click the link to reset your password: ${resetUrl}`,
        actionUrl: resetUrl,
      });
    }
    return { success: true };
  },

  async sendConfirmation(reservationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { customer: true, business: true },
    });
    if (reservation?.customer) {
      await createNotification({
        userId: reservation.customer.id,
        type: 'job_completed',
        title: 'Booking Confirmed',
        body: `Your booking at ${reservation.business?.name} has been confirmed`,
        actionUrl: `/bookings/${reservationId}`,
      });
    }
  },

  async sendBusinessNotification(reservationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { business: true, customer: true },
    });
    if (reservation?.business?.ownerId) {
      await createNotification({
        userId: reservation.business.ownerId,
        type: 'job_completed',
        title: 'New Booking Received',
        body: `${reservation.customer?.firstName} ${reservation.customer?.lastName} booked a reservation`,
        actionUrl: `/reservations/${reservationId}`,
      });
    }
  },

  async sendReviewRequest(reservationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { customer: true, business: true },
    });
    if (reservation?.customer) {
      await createNotification({
        userId: reservation.customer.id,
        type: 'support_reply',
        title: 'Review Your Experience',
        body: `How was your visit to ${reservation.business?.name}?`,
        actionUrl: `/review/${reservationId}`,
      });
    }
  },

  async sendEmail(params: { to: string; subject: string; html: string; text?: string }) {
    const user = await prisma.user.findUnique({ where: { email: params.to } });
    if (user) {
      await createNotification({
        userId: user.id,
        type: 'support_reply',
        title: params.subject,
        body: params.text || params.html.replace(/<[^>]*>/g, '').slice(0, 200),
      });
    }
    return { success: true };
  },
};