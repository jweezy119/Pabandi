"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const axios_1 = __importDefault(require("axios"));
class AnthropicProvider {
    constructor() {
        this.name = 'anthropic';
        this.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    isConfigured() {
        return !!this.apiKey && this.apiKey !== 'REPLACE_WITH_YOUR_ANTHROPIC_API_KEY';
    }
    async complete(messages, options = {}) {
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
        const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
            model,
            system: systemMessage?.content,
            messages: conversationMessages,
            max_tokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.7,
            top_p: options.topP ?? 1,
            stop_sequences: options.stop,
        }, {
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
        });
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
    async embed(_text) {
        // Anthropic doesn't have embeddings API yet; fallback
        throw new Error('Anthropic embeddings not implemented');
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic.provider.js.map