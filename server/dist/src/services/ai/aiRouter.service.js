"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = exports.AIRouter = void 0;
const logger_1 = require("../../utils/logger");
const openai_provider_1 = require("./openai.provider");
const anthropic_provider_1 = require("./anthropic.provider");
const dashscope_service_1 = require("../ai/dashscope.service");
class AIRouter {
    constructor() {
        this.providers = [];
        this.primaryProvider = 'dashscope';
        this.fallbackChain = ['dashscope', 'openai', 'anthropic'];
        this.providers = [
            new dashscope_service_1.DashscopeService(),
            new openai_provider_1.OpenAIProvider(),
            new anthropic_provider_1.AnthropicProvider(),
        ];
    }
    setPrimary(provider) {
        this.primaryProvider = provider;
        // Reorder fallback chain to put primary first
        this.fallbackChain = [provider, ...this.fallbackChain.filter(p => p !== provider)];
    }
    setFallbackChain(chain) {
        this.fallbackChain = chain;
    }
    getAvailableProviders() {
        return this.providers.filter(p => p.isConfigured()).map(p => p.name);
    }
    async complete(messages, options = {}) {
        const errors = [];
        // Try primary first, then fallbacks
        for (const providerName of this.fallbackChain) {
            const provider = this.providers.find(p => p.name === providerName);
            if (!provider || !provider.isConfigured())
                continue;
            try {
                const result = await provider.complete(messages, options);
                logger_1.logger.info(`[AI] Completed with provider=${provider.name} model=${result.model}`);
                return { ...result, provider: provider.name };
            }
            catch (error) {
                const errorMsg = `Provider ${provider.name} failed: ${error.message}`;
                errors.push(errorMsg);
                logger_1.logger.warn(`[AI] ${errorMsg}`);
            }
        }
        throw new Error(`All AI providers failed: ${errors.join(', ')}`);
    }
    async embed(text, preferredProvider) {
        const chain = preferredProvider
            ? [preferredProvider, ...this.fallbackChain.filter(p => p !== preferredProvider)]
            : this.fallbackChain;
        const errors = [];
        for (const providerName of chain) {
            const provider = this.providers.find(p => p.name === providerName);
            if (!provider || !provider.isConfigured())
                continue;
            try {
                const result = await provider.embed(text);
                logger_1.logger.info(`[AI] Embedded with provider=${provider.name} model=${result.model}`);
                return result;
            }
            catch (error) {
                const errorMsg = `Provider ${provider.name} embed failed: ${error.message}`;
                errors.push(errorMsg);
                logger_1.logger.warn(`[AI] ${errorMsg}`);
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
exports.AIRouter = AIRouter;
exports.aiRouter = new AIRouter();
//# sourceMappingURL=aiRouter.service.js.map