"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const axios_1 = __importDefault(require("axios"));
class OpenAIProvider {
    constructor() {
        this.name = 'openai';
        this.apiKey = process.env.OPENAI_API_KEY;
    }
    isConfigured() {
        return !!this.apiKey && this.apiKey !== 'REPLACE_WITH_YOUR_OPENAI_API_KEY';
    }
    async complete(messages, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI API key not configured');
        }
        const model = options.model || 'gpt-4o-mini';
        const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens || 1024,
            stop: options.stop,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
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
    async embed(text) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI API key not configured');
        }
        const response = await axios_1.default.post('https://api.openai.com/v1/embeddings', {
            model: 'text-embedding-3-small',
            input: text,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
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
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai.provider.js.map