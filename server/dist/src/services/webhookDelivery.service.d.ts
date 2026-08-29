export interface WebhookPayload {
    appId: string;
    event: string;
    data: Record<string, any>;
}
export declare function enqueueWebhook(opts: WebhookPayload): Promise<void>;
export declare function processWebhookQueue(): Promise<{
    delivered: number;
    failed: number;
}>;
export declare const webhookDeliveryService: {
    enqueueWebhook: typeof enqueueWebhook;
    processWebhookQueue: typeof processWebhookQueue;
};
//# sourceMappingURL=webhookDelivery.service.d.ts.map