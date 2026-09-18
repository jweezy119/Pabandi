import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiRouter } from './ai/aiRouter.service';

export type DocumentAnalysisResult = {
  summary: string;
  keyEntities: { name: string; value: string }[];
  risks: string[];
  suggestions: string[];
  confidence: number;
};

export class DocumentAIService {
  /**
   * Analyze a document using AI
   */
  async analyzeDocument(managerId: string, fileName: string, textContent: string, documentType: string, fileUrl?: string) {
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

      const result = await aiRouter.complete([
        { role: 'system', content: 'You are a document analysis AI for property management. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 1024 });

      const latencyMs = Date.now() - startTime;
      let analysis: DocumentAnalysisResult;

      try {
        analysis = JSON.parse(result.text);
      } catch {
        analysis = {
          summary: result.text.slice(0, 200),
          keyEntities: [],
          risks: [],
          suggestions: [],
          confidence: 0.5,
        };
      }

      // Save analysis
      const saved = await prisma.documentAnalysis.create({
        data: {
          managerId,
          documentType,
          fileName,
          fileUrl,
          textContent: textContent.slice(0, 10000),
          provider: result.provider,
          model: result.model,
          analysis: analysis as any,
          confidence: analysis.confidence,
          tokensUsed: result.usage?.totalTokens,
          latencyMs,
        },
      });

      return saved;
    } catch (error: any) {
      logger.error('[AI] Document analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get analysis history for a manager
   */
  async getHistory(managerId: string, limit = 50) {
    return prisma.documentAnalysis.findMany({
      where: { managerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const documentAIService = new DocumentAIService();
