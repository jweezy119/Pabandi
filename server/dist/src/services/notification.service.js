"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
exports.createNotification = createNotification;
exports.notifyInvoicePaid = notifyInvoicePaid;
exports.notifyInvoiceOverdue = notifyInvoiceOverdue;
exports.notifyTrustScoreChanged = notifyTrustScoreChanged;
exports.notifyJobCompleted = notifyJobCompleted;
exports.notifyTaskDue = notifyTaskDue;
exports.notifyPaymentClaimed = notifyPaymentClaimed;
exports.notifySupportReply = notifySupportReply;
const database_1 = require("../utils/database");
async function createNotification(params) {
    return database_1.prisma.notification.create({ data: params });
}
async function notifyInvoicePaid(businessOwnerId, invoiceId, invoiceNumber, amount) {
    return createNotification({
        userId: businessOwnerId,
        type: 'invoice_paid',
        title: `Invoice #${invoiceNumber} paid`,
        body: `Payment of $${amount.toLocaleString()} received`,
        actionUrl: `/invoices/${invoiceId}`,
    });
}
async function notifyInvoiceOverdue(businessOwnerId, invoiceId, invoiceNumber, amount) {
    return createNotification({
        userId: businessOwnerId,
        type: 'invoice_overdue',
        title: `Invoice #${invoiceNumber} is overdue`,
        body: `Payment of $${amount.toLocaleString()} is past due`,
        actionUrl: `/invoices/${invoiceId}`,
    });
}
async function notifyTrustScoreChanged(userId, previousScore, newScore, change) {
    if (Math.abs(change) <= 20)
        return; // Only notify for changes > 20
    const direction = change > 0 ? 'increased' : 'decreased';
    return createNotification({
        userId,
        type: 'trust_score_changed',
        title: `Trust score ${direction}`,
        body: `Your trust score ${direction} by ${Math.abs(change)} points to ${newScore}`,
        actionUrl: '/trust/passport',
    });
}
async function notifyJobCompleted(businessOwnerId, jobId, jobTitle) {
    return createNotification({
        userId: businessOwnerId,
        type: 'job_completed',
        title: `Job completed: ${jobTitle}`,
        body: 'A job has been marked as completed',
        actionUrl: `/jobs/${jobId}`,
    });
}
async function notifyTaskDue(assigneeId, taskId, taskTitle, dueInHours) {
    return createNotification({
        userId: assigneeId,
        type: 'task_due',
        title: `Task due soon: ${taskTitle}`,
        body: `This task is due in ${dueInHours} hours`,
        actionUrl: `/tasks/${taskId}`,
    });
}
async function notifyPaymentClaimed(businessOwnerId, invoiceId, invoiceNumber) {
    return createNotification({
        userId: businessOwnerId,
        type: 'payment_claimed',
        title: `Payment claimed for Invoice #${invoiceNumber}`,
        body: 'Client marked this invoice as paid',
        actionUrl: `/invoices/${invoiceId}`,
    });
}
async function notifySupportReply(ticketCreatorId, ticketId, ticketSubject) {
    return createNotification({
        userId: ticketCreatorId,
        type: 'support_reply',
        title: `Reply on support ticket: ${ticketSubject}`,
        body: 'A support agent has replied to your ticket',
        actionUrl: `/support/tickets/${ticketId}`,
    });
}
// Legacy notification service compatibility layer
exports.notificationService = {
    async sendPasswordResetEmail(email, resetUrl, firstName) {
        const user = await database_1.prisma.user.findUnique({ where: { email } });
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
    async sendConfirmation(reservationId) {
        const reservation = await database_1.prisma.reservation.findUnique({
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
    async sendBusinessNotification(reservationId) {
        const reservation = await database_1.prisma.reservation.findUnique({
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
    async sendReviewRequest(reservationId) {
        const reservation = await database_1.prisma.reservation.findUnique({
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
    async sendEmail(params) {
        const user = await database_1.prisma.user.findUnique({ where: { email: params.to } });
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
//# sourceMappingURL=notification.service.js.map