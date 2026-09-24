import { IAIProvider, AICompletionOptions, AICompletionResult, AIEmbeddingResult, AIMessage } from './aiProvider.interface';
export declare class OpenAIProvider implements IAIProvider {
    name: string;
    private apiKey;
    constructor();
    isConfigured(): boolean;
    complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
    embed(text: string): Promise<AIEmbeddingResult>;
}
//# sourceMappingURL=openai.provider.d.ts.map