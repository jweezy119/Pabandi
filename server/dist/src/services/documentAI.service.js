"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentAIService = exports.DocumentAIService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const aiRouter_service_1 = require("./ai/aiRouter.service");
class DocumentAIService {
    /**
     * Analyze a document using AI
     */
    async analyzeDocument(managerId, fileName, textContent, documentType, fileUrl) {
        try {
            const startTime = Date.now();
            const prompt = `Analyze this ${documentType.toLowerCase()} document and provide:
1. A brief summary (2-3 sentences)
2. Key entities (parties, dates, amounts, addresses)
3. Potential risks or red flags
4. Suggestions or improvements

Document content:
${textContent.slice(0, 8000)} // Limit to avoid token overflow

Respond in JSON format:
{
  "summary": "...",
  "keyEntities": [{"name": "entity type", "value": "value"}],
  "risks": ["risk1", "risk2"],
  "suggestions": ["suggestion1"],
  "confidence": 0.9
}`;
            const result = await aiRouter_service_1.aiRouter.complete([
                { role: 'system', content: 'You are a document analysis AI for property management. Always respond with valid JSON.' },
                { role: 'user', content: prompt },
            ], { temperature: 0.3, maxTokens: 1024 });
            const latencyMs = Date.now() - startTime;
            let analysis;
            try {
                analysis = JSON.parse(result.text);
            }
            catch {
                analysis = {
                    summary: result.text.slice(0, 200),
                    keyEntities: [],
                    risks: [],
                    suggestions: [],
                    confidence: 0.5,
                };
            }
            // Save analysis
            const saved = await database_1.prisma.documentAnalysis.create({
                data: {
                    managerId,
                    documentType,
                    fileName,
                    fileUrl,
                    textContent: textContent.slice(0, 10000),
                    provider: result.provider,
                    model: result.model,
                    analysis: analysis,
                    confidence: analysis.confidence,
                    tokensUsed: result.usage?.totalTokens,
                    latencyMs,
                },
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('[AI] Document analysis failed:', error);
            throw error;
        }
    }
    /**
     * Get analysis history for a manager
     */
    async getHistory(managerId, limit = 50) {
        return database_1.prisma.documentAnalysis.findMany({
            where: { managerId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
exports.DocumentAIService = DocumentAIService;
exports.documentAIService = new DocumentAIService();
//# sourceMappingURL=documentAI.service.js.map