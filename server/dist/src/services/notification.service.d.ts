export type NotificationType = 'invoice_paid' | 'invoice_overdue' | 'trust_score_changed' | 'job_completed' | 'task_due' | 'payment_claimed' | 'support_reply';
interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    actionUrl?: string;
}
export declare function createNotification(params: CreateNotificationParams): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifyInvoicePaid(businessOwnerId: string, invoiceId: string, invoiceNumber: string, amount: number): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifyInvoiceOverdue(businessOwnerId: string, invoiceId: string, invoiceNumber: string, amount: number): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifyTrustScoreChanged(userId: string, previousScore: number, newScore: number, change: number): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
} | undefined>;
export declare function notifyJobCompleted(businessOwnerId: string, jobId: string, jobTitle: string): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifyTaskDue(assigneeId: string, taskId: string, taskTitle: string, dueInHours: number): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifyPaymentClaimed(businessOwnerId: string, invoiceId: string, invoiceNumber: string): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare function notifySupportReply(ticketCreatorId: string, ticketId: string, ticketSubject: string): Promise<{
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    read: boolean;
}>;
export declare const notificationService: {
    sendPasswordResetEmail(email: string, resetUrl: string, firstName: string): Promise<{
        success: boolean;
    }>;
    sendConfirmation(reservationId: string): Promise<void>;
    sendBusinessNotification(reservationId: string): Promise<void>;
    sendReviewRequest(reservationId: string): Promise<void>;
    sendEmail(params: {
        to: string;
        subject: string;
        html: string;
        text?: string;
    }): Promise<{
        success: boolean;
    }>;
};
export {};
//# sourceMappingURL=notification.service.d.ts.map