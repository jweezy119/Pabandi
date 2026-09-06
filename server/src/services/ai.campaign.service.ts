import axios from 'axios';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const MAX_INPUT_LENGTH = 500;
const MAX_NAMES_LENGTH = 10;

const DANGEROUS_INJECTION_PATTERNS = [
  /ignore\s+(all|previous|above)/gi,
  /forget\s+(all|previous|above)/gi,
  /you\s+are\s+now\s+(a|an)/gi,
  /system\s*:/gi,
  /overwrite\s+all/i,
];

function sanitizeTemplateVars(
  targetAudience: string,
  goal: string,
  sampleLeadNames: string[]
): {
  targetAudience: string;
  goal: string;
  sampleLeadNames: string[];
  blocked: boolean;
  reason?: string;
} {
  if (targetAudience.length > MAX_INPUT_LENGTH || goal.length > MAX_INPUT_LENGTH) {
    return {
      targetAudience: targetAudience.substring(0, MAX_INPUT_LENGTH),
      goal: goal.substring(0, MAX_INPUT_LENGTH),
      sampleLeadNames,
      blocked: false,
      reason: 'Input truncated to 500 chars',
    };
  }

  for (const pattern of DANGEROUS_INJECTION_PATTERNS) {
    if (pattern.test(targetAudience) || pattern.test(goal)) {
      logger.warn('[AI Campaign] Prompt injection attempt detected in campaign inputs');
      return {
        targetAudience: '[REDACTED]',
        goal: '[REDACTED]',
        sampleLeadNames: [],
        blocked: true,
        reason: 'Input contains potentially unsafe content',
      };
    }
  }

  const safeNames = sampleLeadNames.slice(0, MAX_NAMES_LENGTH).map((n) =>
    typeof n === 'string' ? n.substring(0, 50) : String(n)
  );

  return { targetAudience, goal, sampleLeadNames: safeNames, blocked: false };
}

export const aiCampaignService = {
  async generateCampaignCopy(
    businessId: string,
    targetAudience: string,
    goal: string,
    sampleLeadNames: string[] = []
  ): Promise<string> {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const businessName = business?.name || 'Pabandi Merchant';

    const sanitized = sanitizeTemplateVars(targetAudience, goal, sampleLeadNames);
    if (sanitized.blocked) {
      return `Hi {name}, check out our latest offer at ${businessName}!`;
    }

    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      return `Hi {name}, as a valued customer of ${businessName}, we're excited to offer you this: ${sanitized.goal}. We noticed you fit perfectly into our "${sanitized.targetAudience}" segment! Reply YES to claim.`;
    }

    const systemPrompt = `
You are an expert growth marketer for Pabandi, a Web3 Escrow platform that helps businesses secure bookings and drops.
You are writing a WhatsApp outreach campaign for the business "${businessName}".
Your tone should be engaging, concise, and friendly, optimized for WhatsApp (use emojis and bold text appropriately).
Do NOT include generic placeholders other than {name} for the customer's name.
    `;

    const userPrompt = `
Target Audience: ${sanitized.targetAudience}
Campaign Goal: ${sanitized.goal}
${sanitized.sampleLeadNames.length > 0 ? `Example customer names: ${sanitized.sampleLeadNames.join(', ')}` : ''}

Write a single, high-converting WhatsApp message template for this campaign. Make sure to use '{name}' where the customer's name should be.
    `;

    try {
      const payload = {
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        parameters: {
          result_format: 'message',
        },
      };

      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        payload,
        {
          headers: {
            Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
      return content || "Hey {name}, we have a special offer for you! Check it out now.";
    } catch (error: any) {
      logger.error('[AI Campaign] Error generating copy:', error.response?.data || error.message);
      throw new Error('Failed to generate campaign copy via AI.');
    }
  },

  async findDormantLeads(businessId: string, daysDormant: number = 180) {
    // Stubbed until WaitlistLead CRM model is added to prisma schema
    return [];
  },
};
