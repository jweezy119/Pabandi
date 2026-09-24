export interface ChatFlowNode {
    key: string;
    text: string;
    options?: Record<string, ChatFlowNode>;
}
export interface ChatFlowConfig {
    trigger: string;
    greeting: string;
    options: Record<string, ChatFlowNode>;
    respondInGroups?: boolean;
}
export interface ChatFlowState {
    path: string[];
    lastActive: number;
}
export declare class OpenWAChatFlowService {
    resolveSessionId(): Promise<string>;
    getInstalledPlugins(sessionId?: string): Promise<{
        id?: string;
    }[]>;
    isChatFlowLikelyAvailable(): boolean;
    getInstalledPluginsSync(): {
        id?: string;
    }[];
    sendOutreachFlow(toPhone: string, context?: {
        businessName?: string;
        claimUrl?: string;
    }): Promise<{
        sent: boolean;
        pluginDetected: boolean;
        engine?: string;
        messageId?: string;
        status: string;
    }>;
    sendBulkOutreachFlow(toPhones: string[], context?: {
        businessName?: string;
        claimUrl?: string;
        delayBetweenMessages?: number;
        campaignCopy?: string;
        dailyCap?: number;
    }): Promise<{
        sent: boolean;
        batchId?: string;
        status: string;
        totalMessages?: number;
    }>;
    evaluateMenuByText(flow: ChatFlowConfig, currentState: ChatFlowState | null, messageBody: string): {
        reply: string;
        nextState: ChatFlowState | null;
    };
    isExpired(state: ChatFlowState | null): boolean;
    private resolveOptionsAtPath;
}
export declare const openwaChatFlowService: OpenWAChatFlowService;
//# sourceMappingURL=openwa.chat-flow.service.d.ts.map