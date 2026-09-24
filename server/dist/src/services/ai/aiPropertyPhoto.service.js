"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiPropertyPhotoService = exports.AIPropertyPhotoService = void 0;
const logger_1 = require("../../utils/logger");
const aiRouter_service_1 = require("./aiRouter.service");
const database_1 = require("../../utils/database");
class AIPropertyPhotoService {
    /**
     * Analyze a property photo using AI vision
     */
    async analyzePhoto(photoUrl, context) {
        try {
            const visionProviders = ['openai', 'dashscope'];
            const errors = [];
            for (const providerName of visionProviders) {
                try {
                    const result = await this.analyzeWithProvider(providerName, photoUrl, context);
                    await this.logAnalysis(providerName, photoUrl, result);
                    return result;
                }
                catch (error) {
                    errors.push(`${providerName}: ${error.message}`);
                }
            }
            // If all vision providers fail, return heuristic analysis
            logger_1.logger.warn('[AI] All vision providers failed, using heuristic:', errors.join(', '));
            return this.heuristicAnalysis(photoUrl);
        }
        catch (error) {
            logger_1.logger.error('[AI] Photo analysis failed:', error);
            return this.heuristicAnalysis(photoUrl);
        }
    }
    async analyzeWithProvider(provider, photoUrl, context) {
        const prompt = `Analyze this property photo. Provide:
1. Quality rating (excellent/good/fair/poor)
2. Any visible issues (damage, clutter, poor lighting, etc.)
3. Suggestions for improvement
4. Whether this would make a good cover photo (yes/no)

Context: ${context?.propertyType || 'property'} ${context?.roomType || ''}

Respond in JSON format:
{
  "quality": "good",
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"],
  "isCover": true,
  "confidence": 0.9
}`;
        let result;
        if (provider === 'openai') {
            result = await aiRouter_service_1.aiRouter.complete([
                { role: 'system', content: 'You are a real estate photo analyst. Always respond with valid JSON.' },
                { role: 'user', content: `${prompt}\n\nPhoto URL: ${photoUrl}` },
            ], { model: 'gpt-4o-mini' });
        }
        else if (provider === 'dashscope') {
            // DashScope vision model
            const dashScopeResult = await aiRouter_service_1.aiRouter.complete([
                { role: 'system', content: 'You are a real estate photo analyst. Always respond with valid JSON.' },
                { role: 'user', content: `${prompt}\n\nPhoto URL: ${photoUrl}` },
            ], { model: 'qwen-vl-plus' });
            result = dashScopeResult;
        }
        else {
            throw new Error(`Unsupported vision provider: ${provider}`);
        }
        try {
            const parsed = JSON.parse(result.text);
            return {
                quality: parsed.quality || 'fair',
                issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
                isCover: parsed.isCover || false,
                confidence: parsed.confidence || 0.5,
            };
        }
        catch {
            // If AI didn't return valid JSON, extract from text
            return this.parseTextAnalysis(result.text);
        }
    }
    parseTextAnalysis(text) {
        const lower = text.toLowerCase();
        const quality = lower.includes('excellent') ? 'excellent' : lower.includes('good') ? 'good' : lower.includes('fair') ? 'fair' : 'poor';
        const isCover = lower.includes('cover') || lower.includes('main photo');
        return {
            quality,
            issues: this.extractList(text, ['issue', 'problem', 'damage', 'concern']),
            suggestions: this.extractList(text, ['suggest', 'improve', 'recommend', 'consider']),
            isCover,
            confidence: 0.6,
        };
    }
    extractList(text, keywords) {
        const items = [];
        const lines = text.split('\n');
        for (const line of lines) {
            const lower = line.toLowerCase();
            if (keywords.some(k => lower.includes(k))) {
                const cleaned = line.replace(/^[•\-\*\s]+/, '').trim();
                if (cleaned.length > 3 && cleaned.length < 200) {
                    items.push(cleaned);
                }
            }
        }
        return items.slice(0, 5);
    }
    heuristicAnalysis(_photoUrl) {
        // Fallback when AI vision is unavailable
        return {
            quality: 'fair',
            issues: ['AI vision analysis unavailable'],
            suggestions: ['Manually review photo quality and lighting'],
            isCover: false,
            confidence: 0.3,
        };
    }
    async logAnalysis(provider, photoUrl, result) {
        try {
            await database_1.prisma.aIAnalysis.create({
                data: {
                    type: 'PHOTO_ANALYSIS',
                    provider,
                    input: { photoUrl },
                    output: result,
                    confidence: result.confidence,
                },
            });
        }
        catch (error) {
            logger_1.logger.warn('[AI] Failed to log photo analysis:', error);
        }
    }
}
exports.AIPropertyPhotoService = AIPropertyPhotoService;
exports.aiPropertyPhotoService = new AIPropertyPhotoService();
//# sourceMappingURL=aiPropertyPhoto.service.js.map