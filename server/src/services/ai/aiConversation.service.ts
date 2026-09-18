import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import { aiRouter } from './aiRouter.service';
import { AIMessage } from './aiProvider.interface';

export type ConversationMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export class AIConversationService {
  /**
   * Get or create a conversation session
   */
  async getOrCreateSession(sessionId?: string, userId?: string): Promise<string> {
    if (sessionId) {
      const existing = await prisma.aIConversation.findUnique({ where: { sessionId } });
      if (existing) return sessionId;
    }

    const newSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await prisma.aIConversation.create({
      data: { sessionId: newSessionId, userId: userId || '', messages: [] },
    });
    return newSessionId;
  }

  /**
   * Add a message to conversation history
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, any>) {
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) {
      throw new Error(`Conversation session ${sessionId} not found`);
    }

    const messages = (conversation.messages as any) || [];
    messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    // Keep only last 50 messages to avoid unbounded growth
    const trimmed = messages.slice(-50);

    await prisma.aIConversation.update({
      where: { sessionId },
      data: { messages: trimmed, updatedAt: new Date() },
    });

    return trimmed;
  }

  /**
   * Get conversation history
   */
  async getHistory(sessionId: string, limit = 20) {
    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    if (!conversation) return [];

    const messages = (conversation.messages as any) || [];
    return messages.slice(-limit);
  }

  /**
   * Generate AI response with conversation memory
   */
  async chat(sessionId: string, userMessage: string, systemPrompt?: string, userId?: string) {
    const resolvedSessionId = await this.getOrCreateSession(sessionId, userId);
    
    // Add user message to history
    await this.addMessage(resolvedSessionId, 'user', userMessage);

    // Get conversation history
    const history = await this.getHistory(resolvedSessionId);
    
    // Build messages array for AI
    const messages: AIMessage[] = [];
    
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
      const result = await aiRouter.complete(messages);
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
    } catch (error: any) {
      logger.error('[AI] Conversation chat failed:', error);
      throw new Error(`AI chat failed: ${error.message}`);
    }
  }

  /**
   * Log AI analysis for cost tracking and audit
   */
  private async logAnalysis(data: {
    userId?: string;
    managerId?: string;
    type: string;
    provider: string;
    model?: string;
    input: any;
    output: any;
    confidence?: number;
    tokensUsed?: number;
    latencyMs?: number;
    metadata?: any;
  }) {
    try {
      const costCents = this.estimateCostCents(data.provider, data.model, data.tokensUsed);
      
      await prisma.aIAnalysis.create({
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
    } catch (error) {
      logger.warn('[AI] Failed to log analysis:', error);
    }
  }

  /**
   * Estimate cost in cents based on provider and token usage
   */
  private estimateCostCents(provider: string, model?: string, tokensUsed?: number): number | undefined {
    if (!tokensUsed) return undefined;

    const costPer1KTokens: Record<string, number> = {
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

export const aiConversationService = new AIConversationService();
