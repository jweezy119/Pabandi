export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AICompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type AICompletionResult = {
  text: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
};

export type AIEmbeddingResult = {
  embedding: number[];
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
};

export interface IAIProvider {
  name: string;
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
  embed(text: string): Promise<AIEmbeddingResult>;
  isConfigured(): boolean;
}
