import axios from 'axios';
import { logger } from '../../utils/logger';
import { IAIProvider, AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';

export class OpenAIProvider implements IAIProvider {
  name = 'openai';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'REPLACE_WITH_YOUR_OPENAI_API_KEY';
  }

  async complete(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AICompletionResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || 'gpt-4o-mini';
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1024,
        stop: options.stop,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const choice = response.data.choices[0];
    const usage = response.data.usage;

    return {
      text: choice.message.content,
      provider: this.name,
      model,
      usage: usage ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      finishReason: choice.finish_reason,
    };
  }

  async embed(text: string): Promise<AIEmbeddingResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: text,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    return {
      embedding: data.data[0].embedding,
      provider: this.name,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}
