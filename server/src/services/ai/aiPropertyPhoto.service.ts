import { logger } from '../../utils/logger';
import { aiRouter } from './aiRouter.service';
import { prisma } from '../../utils/database';

export type PropertyPhotoAnalysis = {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
  isCover: boolean;
  confidence: number;
};

export class AIPropertyPhotoService {
  /**
   * Analyze a property photo using AI vision
   */
  async analyzePhoto(photoUrl: string, context?: { propertyType?: string; roomType?: string }): Promise<PropertyPhotoAnalysis> {
    try {
      const visionProviders = ['openai', 'dashscope'];
      const errors: string[] = [];

      for (const providerName of visionProviders) {
        try {
          const result = await this.analyzeWithProvider(providerName, photoUrl, context);
          await this.logAnalysis(providerName, photoUrl, result);
          return result;
        } catch (error: any) {
          errors.push(`${providerName}: ${error.message}`);
        }
      }

      // If all vision providers fail, return heuristic analysis
      logger.warn('[AI] All vision providers failed, using heuristic:', errors.join(', '));
      return this.heuristicAnalysis(photoUrl);
    } catch (error: any) {
      logger.error('[AI] Photo analysis failed:', error);
      return this.heuristicAnalysis(photoUrl);
    }
  }

  private async analyzeWithProvider(provider: string, photoUrl: string, context?: { propertyType?: string; roomType?: string }): Promise<PropertyPhotoAnalysis> {
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
      result = await aiRouter.complete([
        { role: 'system', content: 'You are a real estate photo analyst. Always respond with valid JSON.' },
        { role: 'user', content: `${prompt}\n\nPhoto URL: ${photoUrl}` },
      ], { model: 'gpt-4o-mini' });
    } else if (provider === 'dashscope') {
      // DashScope vision model
      const dashScopeResult = await aiRouter.complete([
        { role: 'system', content: 'You are a real estate photo analyst. Always respond with valid JSON.' },
        { role: 'user', content: `${prompt}\n\nPhoto URL: ${photoUrl}` },
      ], { model: 'qwen-vl-plus' });
      result = dashScopeResult;
    } else {
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
    } catch {
      // If AI didn't return valid JSON, extract from text
      return this.parseTextAnalysis(result.text);
    }
  }

  private parseTextAnalysis(text: string): PropertyPhotoAnalysis {
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

  private extractList(text: string, keywords: string[]): string[] {
    const items: string[] = [];
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

  private heuristicAnalysis(_photoUrl: string): PropertyPhotoAnalysis {
    // Fallback when AI vision is unavailable
    return {
      quality: 'fair',
      issues: ['AI vision analysis unavailable'],
      suggestions: ['Manually review photo quality and lighting'],
      isCover: false,
      confidence: 0.3,
    };
  }

  private async logAnalysis(provider: string, photoUrl: string, result: PropertyPhotoAnalysis) {
    try {
      await prisma.aIAnalysis.create({
        data: {
          type: 'PHOTO_ANALYSIS',
          provider,
          input: { photoUrl },
          output: result,
          confidence: result.confidence,
        },
      });
    } catch (error) {
      logger.warn('[AI] Failed to log photo analysis:', error);
    }
  }
}

export const aiPropertyPhotoService = new AIPropertyPhotoService();
