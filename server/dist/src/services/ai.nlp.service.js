"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiNlpService = void 0;
const axios_1 = __importDefault(require("axios"));
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
function classifyDirect(lower) {
    if (/^(menu|help|start|options|\?|main)$/.test(lower))
        return 'general';
    if (/^(cancel|cancel my booking|cancel reservation)$/.test(lower))
        return 'cancellation';
    if (/\b(book|reserve|appointment|table for|reservation for|want to book)\b/.test(lower))
        return 'booking';
    if (/\b(sales|buy|order|catalog|drop|product)\b/.test(lower))
        return 'sales';
    if (/\b(reschedule|change date|move booking|new date|another day|shift my booking)\b/.test(lower))
        return 'booking';
    if (/\b(status|my booking|my reservation|upcoming|when is my)\b/.test(lower))
        return 'general';
    if (/\b(support|human|agent|talk to someone|escalate|operator)\b/.test(lower))
        return 'support';
    return null;
}
function extractBookingEntities(message) {
    const lower = message.toLowerCase();
    const raw = { message, lower };
    const dateMatch = lower.match(/\b(today|tomorrow|day after tomorrow|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/);
    if (dateMatch)
        raw.dateHint = dateMatch[0];
    const timeMatch = lower.match(/\b(\d{1,2}(?:[:\.]\d{2})?\s?(?:am|pm)?)\b/);
    if (timeMatch)
        raw.timeHint = timeMatch[0];
    const guestsMatch = lower.match(/\b(\d{1,2})\s*(?:guests?|people|pax|persons?|covers?)\b/);
    const partySize = guestsMatch ? parseInt(guestsMatch[1], 10) : undefined;
    const occasionMatch = lower.match(/\b(birthday|anniversary|date night?|business|corporate|honeymoon)\b/);
    if (occasionMatch)
        raw.occasion = occasionMatch[0];
    let intent = 'general';
    if (/\b(book|reserve|appointment|table for|reservation for|want to book)\b/.test(lower))
        intent = 'book_table';
    else if (/\b(cancel|cancel my booking|cancel reservation)\b/.test(lower))
        intent = 'cancel';
    else if (/\b(reschedule|change date|move booking|new date)\b/.test(lower))
        intent = 'reschedule';
    else if (/\b(menu|food|drink|order food|dishes)\b/.test(lower))
        intent = 'check_menu';
    else if (/\b(hours?|open|clos(e|ing)|timing)\b/.test(lower))
        intent = 'hours';
    else if (/\b(help|human|agent|talk to someone)\b/.test(lower))
        intent = 'human';
    else if (/\b(faq|questions|refund|deposit|no-show|parking)\b/.test(lower))
        intent = 'faq';
    return {
        intent,
        partySize,
        date: dateMatch ? dateMatch[0] : undefined,
        time: timeMatch ? timeMatch[0] : undefined,
        occasion: occasionMatch ? occasionMatch[0] : undefined,
        raw,
    };
}
class AiNlpService {
    getEnabledModels() {
        return ['qwen-turbo', 'qwen-plus', 'qwen-max'];
    }
    async classifyIntentAndLanguage(message) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            const entities = extractBookingEntities(message);
            return { intent: entities.intent === 'book_table' ? 'booking' : entities.intent === 'check_menu' || entities.intent === 'ask_question' ? 'support' : 'general', language: 'en', sentiment: 'neutral', confidence: 0.7 };
        }
        const context = `
You are an intent classification engine. Analyze the following user message and classify it.
Output ONLY a raw JSON object with no markdown formatting.
Schema:
{
  "intent": "booking" | "support" | "cancellation" | "general" | "sales" | "book_table" | "check_menu" | "ask_question",
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
                        { role: 'user', content: message },
                    ],
                },
                parameters: { result_format: 'message' },
            };
            const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                headers: {
                    Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });
            const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
            if (content) {
                const jsonStr = content.replace(/^```json\n?/, '').replace(/```$/, '').trim();
                const result = JSON.parse(jsonStr);
                return result;
            }
        }
        catch (error) {
            const fallback = this.localFallback(message);
            if (fallback)
                return fallback;
            console.error('[AI NLP] Error classifying message:', error.response?.data || error.message);
        }
        const entities = extractBookingEntities(message);
        return {
            intent: entities.intent === 'book_table' ? 'booking' : entities.intent === 'check_menu' || entities.intent === 'ask_question' ? 'support' : 'general',
            language: /[\u0600-\u06FF]/.test(message) ? 'ar' : 'en',
            sentiment: 'neutral',
            confidence: 0.4,
        };
    }
    localFallback(message) {
        const lower = message.toLowerCase();
        const direct = classifyDirect(lower);
        if (direct)
            return { intent: direct, language: 'en', sentiment: 'neutral', confidence: 0.7 };
        if (/\b(book|reserve|table for|reservation for|want to book)\b/.test(lower))
            return { intent: 'booking', language: 'en', sentiment: 'neutral', confidence: 0.7 };
        return null;
    }
    async extractBookingEntities(message) {
        return extractBookingEntities(message);
    }
    async generateCopy(template, contextVars) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return `[Mock Generated] ${template} using ${JSON.stringify(contextVars)}`;
        }
        let contextStr = 'Context Variables:\n';
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
                        { role: 'user', content: `Template/Instruction: ${template}\n\n${contextStr}` },
                    ],
                },
                parameters: { result_format: 'message' },
            };
            const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                headers: {
                    Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });
            const content = response.data?.output?.choices?.[0]?.message?.content?.trim();
            return content || template;
        }
        catch (error) {
            console.error('[AI NLP] Error generating copy:', error.response?.data || error.message);
            return 'Sorry, I am having trouble understanding right now. Please try again or use the app.';
        }
    }
}
exports.aiNlpService = new AiNlpService();
//# sourceMappingURL=ai.nlp.service.js.map