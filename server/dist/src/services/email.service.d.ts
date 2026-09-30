export declare function sendEmail({ to, subject, html }: {
    to: any;
    subject: any;
    html: any;
}): Promise<{
    id: string;
} | {
    skipped: boolean;
    error?: undefined;
} | {
    error: any;
    skipped?: undefined;
}>;
export declare const emailService: {
    sendBookingConfirmation(data: {
        to: string;
        businessName: string;
        date: string;
        time: string;
        guests: number;
        confirmationCode?: string;
    }): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendBookingReminder(data: {
        to: string;
        businessName: string;
        date: string;
        time: string;
        guests: number;
        confirmationCode?: string;
    }): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendInvoiceSent(client: any, invoice: any, business: any): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendInvoiceReminder(client: any, invoice: any, business: any): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendPaymentReceived(business: any, invoice: any, client: any): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendPaymentClaimed(business: any, invoice: any, client: any): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendWelcome(user: any): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
    sendTrustScoreChanged(user: any, field: string, oldScore: number, newScore: number): Promise<{
        id: string;
    } | {
        skipped: boolean;
        error?: undefined;
    } | {
        error: any;
        skipped?: undefined;
    }>;
};
//# sourceMappingURL=email.service.d.ts.map