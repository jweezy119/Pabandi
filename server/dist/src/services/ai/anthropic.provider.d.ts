import { IAIProvider, AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';
export declare class AnthropicProvider implements IAIProvider {
    name: string;
    private apiKey;
    constructor();
    isConfigured(): boolean;
    complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
    embed(_text: string): Promise<AIEmbeddingResult>;
}
//# sourceMappingURL=anthropic.provider.d.ts.map