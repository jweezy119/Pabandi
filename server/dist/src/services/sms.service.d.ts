interface SMSResult {
    success: boolean;
    messageId?: string;
    provider: 'TWILIO' | 'VONAGE';
    cost?: number;
    error?: string;
}
interface BulkSMSResult {
    total: number;
    sent: number;
    failed: number;
    results: SMSResult[];
}
export declare class SMSService {
    private twilioClient;
    private vonageClient;
    private twilioFrom;
    private vonageFrom;
    constructor();
    sendSMS(to: string, message: string, businessId?: string): Promise<SMSResult>;
    sendBulkSMS(numbers: string[], message: string, businessId?: string): Promise<BulkSMSResult>;
    getStatus(messageId: string, provider?: 'TWILIO' | 'VONAGE'): Promise<{
        status?: string;
        deliveredAt?: Date;
        error?: string;
    }>;
    handleTwilioWebhook(payload: any): Promise<void>;
    getSMSLogs(businessId: string, limit?: number, offset?: number): Promise<{
        message: string;
        error: string | null;
        provider: string;
        id: string;
        createdAt: Date;
        businessId: string;
        status: string;
        externalId: string | null;
        to: string;
        sentAt: Date | null;
        cost: number | null;
        deliveredAt: Date | null;
    }[]>;
    private sendViaVonage;
    private loadVonageClient;
    private logSMS;
    private formatPhone;
    private estimateCost;
}
export declare const smsService: SMSService;
export {};
//# sourceMappingURL=sms.service.d.ts.map