"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiConversationService = exports.AIConversationService = void 0;
const database_1 = require("../../utils/database");
const logger_1 = require("../../utils/logger");
const aiRouter_service_1 = require("./aiRouter.service");
class AIConversationService {
    /**
     * Get or create a conversation session
     */
    async getOrCreateSession(sessionId, userId) {
        if (sessionId) {
            const existing = await database_1.prisma.aIConversation.findUnique({ where: { sessionId } });
            if (existing)
                return sessionId;
        }
        const newSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await database_1.prisma.aIConversation.create({
            data: { sessionId: newSessionId, userId: userId || '', messages: [] },
        });
        return newSessionId;
    }
    /**
     * Add a message to conversation history
     */
    async addMessage(sessionId, role, content, metadata) {
        const conversation = await database_1.prisma.aIConversation.findUnique({ where: { sessionId } });
        if (!conversation) {
            throw new Error(`Conversation session ${sessionId} not found`);
        }
        const messages = conversation.messages || [];
        messages.push({
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata,
        });
        // Keep only last 50 messages to avoid unbounded growth
        const trimmed = messages.slice(-50);
        await database_1.prisma.aIConversation.update({
            where: { sessionId },
            data: { messages: trimmed, updatedAt: new Date() },
        });
        return trimmed;
    }
    /**
     * Get conversation history
     */
    async getHistory(sessionId, limit = 20) {
        const conversation = await database_1.prisma.aIConversation.findUnique({ where: { sessionId } });
        if (!conversation)
            return [];
        const messages = conversation.messages || [];
        return messages.slice(-limit);
    }
    /**
     * Generate AI response with conversation memory
     */
    async chat(sessionId, userMessage, systemPrompt, userId) {
        const resolvedSessionId = await this.getOrCreateSession(sessionId, userId);
        // Add user message to history
        await this.addMessage(resolvedSessionId, 'user', userMessage);
        // Get conversation history
        const history = await this.getHistory(resolvedSessionId);
        // Build messages array for AI
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        // Add last 10 messages as context (to stay within token limits)
        const contextMessages = history.slice(-10);
        for (const msg of contextMessages) {
            messages.push({ role: msg.role, content: msg.content });
        }
        try {
            const startTime = Date.now();
            const result = await aiRouter_service_1.aiRouter.complete(messages);
            const latencyMs = Date.now() - startTime;
            // Add assistant response to history
            await this.addMessage(resolvedSessionId, 'assistant', result.text, {
                provider: result.provider,
                model: result.model,
                latencyMs,
            });
            // Log AI analysis for tracking
            await this.logAnalysis({
                userId,
                type: 'CONVERSATION',
                provider: result.provider,
                model: result.model,
                input: { messages: messages.length, userMessage },
                output: { response: result.text },
                tokensUsed: result.usage?.totalTokens,
                latencyMs,
            });
            return {
                sessionId: resolvedSessionId,
                response: result.text,
                provider: result.provider,
                model: result.model,
            };
        }
        catch (error) {
            logger_1.logger.error('[AI] Conversation chat failed:', error);
            throw new Error(`AI chat failed: ${error.message}`);
        }
    }
    /**
     * Log AI analysis for cost tracking and audit
     */
    async logAnalysis(data) {
        try {
            const costCents = this.estimateCostCents(data.provider, data.model, data.tokensUsed);
            await database_1.prisma.aIAnalysis.create({
                data: {
                    userId: data.userId,
                    managerId: data.managerId,
                    type: data.type,
                    provider: data.provider,
                    model: data.model,
                    input: data.input,
                    output: data.output,
                    confidence: data.confidence,
                    tokensUsed: data.tokensUsed,
                    costCents,
                    latencyMs: data.latencyMs,
                    metadata: data.metadata,
                },
            });
        }
        catch (error) {
            logger_1.logger.warn('[AI] Failed to log analysis:', error);
        }
    }
    /**
     * Estimate cost in cents based on provider and token usage
     */
    estimateCostCents(provider, model, tokensUsed) {
        if (!tokensUsed)
            return undefined;
        const costPer1KTokens = {
            'gpt-4o-mini': 0.15,
            'gpt-4o': 2.5,
            'gpt-4-turbo': 10,
            'claude-3-5-haiku-20241022': 0.25,
            'claude-3-5-sonnet-20241022': 3,
            'qwen-turbo': 0.3,
            'qwen-plus': 1.5,
            'qwen-max': 5,
        };
        const rate = costPer1KTokens[model || ''] || costPer1KTokens[`${provider}:default`] || 0.5;
        return (tokensUsed / 1000) * rate;
    }
}
exports.AIConversationService = AIConversationService;
exports.aiConversationService = new AIConversationService();
//# sourceMappingURL=aiConversation.service.js.map