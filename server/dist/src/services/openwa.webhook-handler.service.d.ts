interface AckRecord {
    messageId: string;
    ack: number;
    updatedAt: number;
}
export declare function registerWebhookHandlers(): void;
/**
 * Public helper to check if a message was delivered/read.
 */
export declare function getMessageAck(messageId: string): AckRecord | null;
export {};
//# sourceMappingURL=openwa.webhook-handler.service.d.ts.map