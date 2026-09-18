import axios from 'axios';
import { logger } from '../../utils/logger';
import { IAIProvider, AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';

export class AnthropicProvider implements IAIProvider {
  name = 'anthropic';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'REPLACE_WITH_YOUR_ANTHROPIC_API_KEY';
  }

  async complete(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AICompletionResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || 'claude-3-5-haiku-20241022';
    
    // Separate system message from conversation
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        system: systemMessage?.content,
        messages: conversationMessages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 1,
        stop_sequences: options.stop,
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.content[0];
    const usage = response.data.usage;

    return {
      text: content.text,
      provider: this.name,
      model,
      usage: usage ? {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
      } : undefined,
      finishReason: response.data.stop_reason,
    };
  }

  async embed(_text: string): Promise<AIEmbeddingResult> {
    // Anthropic doesn't have embeddings API yet; fallback
    throw new Error('Anthropic embeddings not implemented');
  }
}
