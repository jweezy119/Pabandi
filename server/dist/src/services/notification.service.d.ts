export declare class NotificationService {
    /**
     * Send Firebase Cloud Messaging Push Notification for reservation
     */
    sendPushNotification(fcmToken: string, reservation: {
        businessName: string;
        reservationDate: string;
        reservationTime: string;
        customerName: string;
    }): Promise<boolean>;
    /**
     * Send email reminder for reservation via Gmail SMTP
     */
    sendEmailReminder(email: string, reservation: {
        businessName: string;
        reservationDate: string;
        reservationTime: string;
        customerName: string;
        businessAddress: string;
    }): Promise<boolean>;
    /**
     * Send password reset email
     */
    sendPasswordResetEmail(email: string, resetUrl: string, firstName: string): Promise<boolean>;
    /**
     * Send confirmation notification when reservation is created
     */
    sendConfirmation(reservationId: string): Promise<void>;
    /**
     * Schedule reminder for reservation (should be called by a cron job)
     */
    sendReminder(reservationId: string): Promise<void>;
    /**
     * Send WhatsApp notification to business owner on new booking
     */
    sendBusinessNotification(reservationId: string): Promise<void>;
    /**
     * Send WhatsApp review request after completion
     */
    sendReviewRequest(reservationId: string): Promise<void>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map