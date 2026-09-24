export type ConversationMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: Date;
};
export declare class AIConversationService {
    /**
     * Get or create a conversation session
     */
    getOrCreateSession(sessionId?: string, userId?: string): Promise<string>;
    /**
     * Add a message to conversation history
     */
    addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, any>): Promise<any>;
    /**
     * Get conversation history
     */
    getHistory(sessionId: string, limit?: number): Promise<any>;
    /**
     * Generate AI response with conversation memory
     */
    chat(sessionId: string, userMessage: string, systemPrompt?: string, userId?: string): Promise<{
        sessionId: string;
        response: string;
        provider: string;
        model: string;
    }>;
    /**
     * Log AI analysis for cost tracking and audit
     */
    private logAnalysis;
    /**
     * Estimate cost in cents based on provider and token usage
     */
    private estimateCostCents;
}
export declare const aiConversationService: AIConversationService;
//# sourceMappingURL=aiConversation.service.d.ts.map