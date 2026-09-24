export declare function sendVerificationEmail(to: string, code: string, firstName: string): Promise<boolean>;
export declare function generateVerificationCode(): string;
/** True when a real mail provider is configured; otherwise codes are only logged. */
export declare function isEmailConfigured(): boolean;
export declare const emailService: {
    /**
     * Send booking confirmation email
     */
    sendBookingConfirmation(booking: any): Promise<void>;
    /**
     * Send guest list confirmation email
     */
    sendGuestListConfirmation(entry: any): Promise<void>;
    /**
     * Send promoter commission notification
     */
    sendPromoterCommissionNotification(promoter: any, amount: number, bookingId: string): Promise<void>;
    /**
     * Core email sending function
     * Uses Resend if API key is set, otherwise logs to console
     */
    sendEmail(to: string, subject: string, html: string, type: string): Promise<{
        status: string;
        errorMessage: string | null;
    }>;
};
//# sourceMappingURL=email.service.d.ts.map