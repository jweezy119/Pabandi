import axios from 'axios';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';

export type Intent = 'booking' | 'support' | 'cancellation' | 'general' | 'sales';

export interface ClassificationResult {
  intent: Intent;
  language: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

class AiNlpService {
  getEnabledModels(): string[] {
    return ['qwen-turbo', 'qwen-plus', 'qwen-max'];
  }

  /**
   * Classify a message's intent, language, and sentiment using DashScope Qwen model
   */
  async classifyIntentAndLanguage(message: string): Promise<ClassificationResult> {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      // Mock fallback
      return {
        intent: 'general',
        language: 'en',
        sentiment: 'neutral',
        confidence: 0.8
      };
    }

    const context = `
You are an intent classification engine. Analyze the following user message and classify it.
Output ONLY a raw JSON object with no markdown formatting.
Schema:
{
  "intent": "booking" | "support" | "cancellation" | "general" | "sales",
  "language": "en" | "ur" | "ar" | "es" etc (ISO 639-1 code),
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": (number between 0 and 1)
}
    `;

    try {
      const payload = {
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: context },
            { role: 'user', content: message }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      };

      const response = await axios.post(
        'https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        payload,
        {
          headers: {
            Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
      
      if (content) {
        // Strip markdown backticks if present
        const jsonStr = content.replace(/^```json\n?/, '').replace(/```$/, '').trim();
        const result = JSON.parse(jsonStr) as ClassificationResult;
        return result;
      }
    } catch (error: any) {
      console.error('[AI NLP] Error classifying message:', error.response?.data || error.message);
    }

    // Default fallback
    return {
      intent: 'general',
      language: 'en',
      sentiment: 'neutral',
      confidence: 0.5
    };
  }

  /**
   * Generate contextual copy using a template and variables
   */
  async generateCopy(template: string, contextVars: Record<string, any>): Promise<string> {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      return `[Mock Generated] ${template} using ${JSON.stringify(contextVars)}`;
    }
    
    let contextStr = "Context Variables:\n";
    for (const [key, value] of Object.entries(contextVars)) {
      contextStr += `- ${key}: ${JSON.stringify(value)}\n`;
    }

    const systemPrompt = `
You are a highly skilled copywriter for Pabandi, a Web3 Escrow platform. 
Use the provided template instructions and the context variables to generate a natural, conversational response.
Output ONLY the final message text. Do not include markdown unless appropriate for WhatsApp (*bold*, _italic_).
`;

    try {
      const payload = {
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Template/Instruction: ${template}\n\n${contextStr}` }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      };

      const response = await axios.post(
        'https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        payload,
        {
          headers: {
            Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
      return content || template;
    } catch (error: any) {
      console.error('[AI NLP] Error generating copy:', error.response?.data || error.message);
      return "Sorry, I am having trouble understanding right now. Please try again or use the app.";
    }
  }
}

export const aiNlpService = new AiNlpService();
