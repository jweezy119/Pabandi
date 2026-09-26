"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get PerksEngine () {
        return PerksEngine;
    },
    get perksEngine () {
        return perksEngine;
    }
});
const _axios = /*#__PURE__*/ _interop_require_default(require("axios"));
const _logger = require("../../utils/logger");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
let PerksEngine = class PerksEngine {
    async generatePerkOffer(businessCategory, guestCount, advanceBookingDays, isWeekend) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return "Upgrade your experience with our exclusive Hibah perks. Reply YES to see options!";
        }
        try {
            const prompt = `
You are the Contextual Perks Engine for Pabandi.
Generate a short, warm, 1-sentence upsell offer (framed as a "PabPoints/Hibah" reward) for a booking.
Strictly use the following anonymized booking details to recommend a relevant perk:
- Business Category: ${businessCategory}
- Guest Count: ${guestCount}
- Booking made ${advanceBookingDays} days in advance
- Is Weekend: ${isWeekend ? 'Yes' : 'No'}

DO NOT include placeholders for names like [Name]. Start the sentence directly.
Example: "Since you're booking early for the weekend, you've unlocked a Hibah reward: add a late checkout for just 500 PabPoints. Reply YES to claim!"
      `.trim();
            const payload = {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an AI generating concise upsell offers for reservations.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            };
            const response = await _axios.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                timeout: 3000,
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data?.output?.choices?.[0]?.message?.content) {
                return response.data.output.choices[0].message.content.trim();
            }
            return "Upgrade your experience with our exclusive Hibah perks. Reply YES to see options!";
        } catch (error) {
            _logger.logger.error('[PerksEngine] Error generating perk:', error.response?.data || error.message);
            return "Unlock exclusive Hibah perks for your upcoming visit. Reply YES to learn more!";
        }
    }
    async generateSmartReminder(businessCategory, dayOfWeek) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return "We are looking forward to seeing you!";
        }
        try {
            const days = [
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ];
            const dayName = days[dayOfWeek];
            const prompt = `
Generate a friendly, 1-sentence reminder tip for an upcoming ${businessCategory} reservation on a ${dayName}.
DO NOT include placeholders for names. Start the sentence directly.
Example: "Get ready for a fantastic ${dayName} evening! Make sure to arrive 10 minutes early to secure the best spot."
      `.trim();
            const payload = {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        {
                            role: 'system',
                            content: 'You generate short, helpful reservation reminder tips.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            };
            const response = await _axios.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                timeout: 3000,
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data?.output?.choices?.[0]?.message?.content) {
                return response.data.output.choices[0].message.content.trim();
            }
            return "We are looking forward to seeing you soon!";
        } catch (error) {
            _logger.logger.error('[PerksEngine] Error generating smart reminder:', error.response?.data || error.message);
            return "We are looking forward to seeing you soon!";
        }
    }
    async generateWaitlistRescue(businessCategory) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return "A spot just opened up for you! Reply YES within 15 minutes to confirm.";
        }
        try {
            const prompt = `
Generate a short, urgent (but polite) 1-sentence waitlist rescue SMS for a ${businessCategory}.
A spot has just opened up due to a cancellation.
DO NOT use placeholders like [Name]. Start the sentence directly.
Example: "Great news! A slot just opened up for your waitlisted booking. Reply YES within 15 minutes to secure it."
      `.trim();
            const payload = {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        {
                            role: 'system',
                            content: 'You generate short waitlist rescue notifications.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            };
            const response = await _axios.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                timeout: 3000,
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data?.output?.choices?.[0]?.message?.content) {
                return response.data.output.choices[0].message.content.trim();
            }
            return "Great news! A slot just opened up for your waitlisted booking. Reply YES within 15 minutes to secure it.";
        } catch (error) {
            _logger.logger.error('[PerksEngine] Error generating waitlist rescue:', error.response?.data || error.message);
            return "Great news! A slot just opened up for your waitlisted booking. Reply YES within 15 minutes to secure it.";
        }
    }
    async generateFlashPerk(businessCategory, timeOfDay, trustScore) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return `Exclusive Flash Perk: 20% off your next booking right now because you have a stellar Trust Score of ${trustScore}!`;
        }
        try {
            const prompt = `
Generate a short, enticing 1-sentence "Flash Perk" deal for a highly reliable customer (Trust Score: ${trustScore}) at a ${businessCategory} during ${timeOfDay}.
The venue has low capacity right now, so we are giving them a VIP deal to come in immediately.
DO NOT use placeholders. Keep it punchy and exclusive.
Example: "Because of your flawless ${trustScore} Trust Score, enjoy 25% off all appetizers tonight at our lounge if you book within the next hour!"
      `.trim();
            const payload = {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        {
                            role: 'system',
                            content: 'You generate exclusive VIP flash deals for highly reliable customers.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            };
            const response = await _axios.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
                timeout: 3000,
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data?.output?.choices?.[0]?.message?.content) {
                return response.data.output.choices[0].message.content.trim();
            }
            return `VIP Flash Deal: Book right now and get 20% off your entire experience thanks to your ${trustScore} Trust Score!`;
        } catch (error) {
            _logger.logger.error('[PerksEngine] Error generating flash perk:', error.response?.data || error.message);
            return `VIP Flash Deal: Book right now and get 20% off your entire experience thanks to your ${trustScore} Trust Score!`;
        }
    }
};
const perksEngine = new PerksEngine();

//# sourceMappingURL=perksEngine.js.map