"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiCampaignService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../utils/database");
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
exports.aiCampaignService = {
    /**
     * Generates promotional copy using AI based on target audience and goal.
     * If a list of leads is provided, it can generate personalized variants or a general broadcast template.
     */
    async generateCampaignCopy(businessId, targetAudience, goal, sampleLeadNames = []) {
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        const businessName = business?.name || 'Pabandi Merchant';
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return `Hi {name}, as a valued customer of ${businessName}, we're excited to offer you this: ${goal}. We noticed you fit perfectly into our "${targetAudience}" segment! Reply YES to claim.`;
        }
        const systemPrompt = `
You are an expert growth marketer for Pabandi, a Web3 Escrow platform that helps businesses secure bookings and drops.
You are writing a WhatsApp outreach campaign for the business "${businessName}".
Your tone should be engaging, concise, and friendly, optimized for WhatsApp (use emojis and bold text appropriately).
Do NOT include generic placeholders other than {name} for the customer's name.
    `;
        const userPrompt = `
Target Audience: ${targetAudience}
Campaign Goal: ${goal}
${sampleLeadNames.length > 0 ? `Example customer names: ${sampleLeadNames.join(', ')}` : ''}

Write a single, high-converting WhatsApp message template for this campaign. Make sure to use '{name}' where the customer's name should be.
    `;
        try {
            const payload = {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            };
            const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                headers: {
                    Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
            return content || "Hey {name}, we have a special offer for you! Check it out now.";
        }
        catch (error) {
            console.error('[AI Campaign] Error generating copy:', error.response?.data || error.message);
            throw new Error('Failed to generate campaign copy via AI.');
        }
    },
    /**
     * Find dormant customers who haven't been contacted in a while.
     */
    async findDormantLeads(businessId, daysDormant = 180) {
        // Stubbed until WaitlistLead CRM model is added to prisma schema
        return [];
    }
};
//# sourceMappingURL=ai.campaign.service.js.map