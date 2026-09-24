export interface IntentReply {
    reply: string;
    pluginSummary?: string;
    matchedIntent?: string;
}
export declare class WhatsAppIntentService {
    match(message: string, context?: {
        businessName?: string;
        keywords?: string[];
    }): IntentReply | null;
    private pluginSummaryFor;
}
export declare const whatsAppIntentService: WhatsAppIntentService;
//# sourceMappingURL=whatsapp-intent.service.d.ts.map