export interface SmartReply {
    text: string;
    matchedIntent?: string;
    pluginSummary?: string;
    action?: string;
    traceId?: string;
}
export interface SmartSession {
    phone: string;
    businessPhone: string;
    intent: string;
    step: string;
    data: Record<string, unknown>;
    updatedAt: number;
}
export declare class WhatsAppSmartService {
    private sessions;
    private conversations;
    private sessionKey;
    private evictExpiredSessions;
    private touchSession;
    getSession(phone: string, businessPhone: string): SmartSession | undefined;
    setSession(phone: string, businessPhone: string, session: SmartSession): void;
    clearSession(phone: string, businessPhone: string): void;
    getConversation(phone: string): {
        from: "user" | "agent";
        text: string;
        at: number;
    }[];
    appendConversation(phone: string, from: 'user' | 'agent', text: string): {
        from: "user" | "agent";
        text: string;
        at: number;
    }[];
    reply(customerPhone: string, text: string, pluginSummary?: string, businessPhone?: string): Promise<string>;
    runSmartAction(intent: string, context?: {
        customerPhone?: string;
        businessPhone?: string;
        message?: string;
    }): Promise<SmartReply | null>;
    processMessage(customerPhone: string, businessPhone: string, message: string): Promise<SmartReply | null>;
    capabilities(): {
        flows: string[];
        pluginAware: boolean;
        sessionMemory: boolean;
        conversationalBooking: boolean;
        scopedSessions: boolean;
        sessionTtlMs: number;
        persistSmartSignals: boolean;
    };
    private replyWithMenu;
    private handleNewConversation;
    private handleBookingFlow;
    private advanceBookingFlow;
    private handleCancelFlow;
    private handleStatusFlow;
    private handleHandoff;
    private introForIntent;
    private matchIntent;
    private pluginSummary;
    private isOutOfHours;
}
export declare const whatsAppSmartService: WhatsAppSmartService;
//# sourceMappingURL=whatsapp.smart.service.d.ts.map