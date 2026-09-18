import { logger } from '../../utils/logger';
import { IAIProvider, AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { DashscopeService } from '../ai/dashscope.service';

export type AIProviderName = 'openai' | 'anthropic' | 'dashscope';

export class AIRouter {
  private providers: IAIProvider[] = [];
  private primaryProvider: AIProviderName = 'dashscope';
  private fallbackChain: AIProviderName[] = ['dashscope', 'openai', 'anthropic'];

  constructor() {
    this.providers = [
      new DashscopeService() as unknown as IAIProvider,
      new OpenAIProvider(),
      new AnthropicProvider(),
    ];
  }

  setPrimary(provider: AIProviderName) {
    this.primaryProvider = provider;
    // Reorder fallback chain to put primary first
    this.fallbackChain = [provider, ...this.fallbackChain.filter(p => p !== provider)];
  }

  setFallbackChain(chain: AIProviderName[]) {
    this.fallbackChain = chain;
  }

  getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isConfigured()).map(p => p.name);
  }

  async complete(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AICompletionResult & { provider: string }> {
    const errors: string[] = [];
    
    // Try primary first, then fallbacks
    for (const providerName of this.fallbackChain) {
      const provider = this.providers.find(p => p.name === providerName);
      if (!provider || !provider.isConfigured()) continue;

      try {
        const result = await provider.complete(messages, options);
        logger.info(`[AI] Completed with provider=${provider.name} model=${result.model}`);
        return { ...result, provider: provider.name };
      } catch (error: any) {
        const errorMsg = `Provider ${provider.name} failed: ${error.message}`;
        errors.push(errorMsg);
        logger.warn(`[AI] ${errorMsg}`);
      }
    }

    throw new Error(`All AI providers failed: ${errors.join(', ')}`);
  }

  async embed(text: string, preferredProvider?: AIProviderName): Promise<AIEmbeddingResult> {
    const chain = preferredProvider 
      ? [preferredProvider, ...this.fallbackChain.filter(p => p !== preferredProvider)]
      : this.fallbackChain;

    const errors: string[] = [];

    for (const providerName of chain) {
      const provider = this.providers.find(p => p.name === providerName);
      if (!provider || !provider.isConfigured()) continue;

      try {
        const result = await provider.embed(text);
        logger.info(`[AI] Embedded with provider=${provider.name} model=${result.model}`);
        return result;
      } catch (error: any) {
        const errorMsg = `Provider ${provider.name} embed failed: ${error.message}`;
        errors.push(errorMsg);
        logger.warn(`[AI] ${errorMsg}`);
      }
    }

    throw new Error(`All embedding providers failed: ${errors.join(', ')}`);
  }

  getStatus() {
    return {
      primary: this.primaryProvider,
      fallbackChain: this.fallbackChain,
      available: this.getAvailableProviders(),
      providers: this.providers.map(p => ({
        name: p.name,
        configured: p.isConfigured(),
      })),
    };
  }
}

export const aiRouter = new AIRouter();
