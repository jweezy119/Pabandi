import { AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';
export type AIProviderName = 'openai' | 'anthropic' | 'dashscope';
export declare class AIRouter {
    private providers;
    private primaryProvider;
    private fallbackChain;
    constructor();
    setPrimary(provider: AIProviderName): void;
    setFallbackChain(chain: AIProviderName[]): void;
    getAvailableProviders(): string[];
    complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult & {
        provider: string;
    }>;
    embed(text: string, preferredProvider?: AIProviderName): Promise<AIEmbeddingResult>;
    getStatus(): {
        primary: AIProviderName;
        fallbackChain: AIProviderName[];
        available: string[];
        providers: {
            name: string;
            configured: boolean;
        }[];
    };
}
export declare const aiRouter: AIRouter;
//# sourceMappingURL=aiRouter.service.d.ts.map