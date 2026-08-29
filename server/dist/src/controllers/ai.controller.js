"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConciergeQuery = void 0;
const database_1 = require("../utils/database");
const axios_1 = __importDefault(require("axios"));
const blockchain_service_1 = require("../services/blockchain.service");
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const handleConciergeQuery = async (req, res) => {
    try {
        const { query, walletAddress } = req.body;
        const user = req.user; // from authMiddleware
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            return res.status(500).json({ error: "DashScope API key is not configured." });
        }
        let systemContext = `You are the Pabandi AI Concierge powered by Alibaba Cloud Qwen.
You help users find restaurants, salons, and make reservations.
The user asking is ${user?.firstName || 'a guest'}.
Please respond concisely.`;
        const isValidSolanaAddress = (address) => typeof address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        if (walletAddress && isValidSolanaAddress(walletAddress)) {
            const profile = await blockchain_service_1.blockchainService.getSolanaWalletProfile(walletAddress);
            if (profile && profile.status !== 'error') {
                systemContext += `\n\n[Web3 Intelligence]\nWe have analyzed the user's connected Solana wallet (${walletAddress}):\n`;
                systemContext += `- Estimated Net Worth: $${profile.estimatedNetWorthUsd}\n`;
                systemContext += `- Profile: ${profile.profileDescription}\n`;
                systemContext += `\nCRITICAL INSTRUCTION: Since the user has a known Web3 profile, you MUST tailor your recommendations to their lifestyle. If they are a 'High Net Worth Individual' or 'DeFi Whale', prioritize luxury, premium, or VIP venues. Acknowledge their on-chain status subtly (e.g. "As a premium Web3 collector...").\n`;
            }
        }
        systemContext += `
If the user wants to book, output a JSON block at the end of your message in this exact format:
\`\`\`json
{
  "proposedBusinessId": "id-of-the-business",
  "businessName": "Name of Business",
  "reservationDate": "YYYY-MM-DD",
  "reservationTime": "HH:MM",
  "numberOfGuests": 2
}
\`\`\`
If you don't know the exact business ID, leave it empty or make a best guess from the list provided.`;
        // Fetch some available businesses to give the AI context
        const businesses = await database_1.prisma.business.findMany({
            where: { isActive: true },
            take: 10,
            select: { id: true, name: true, category: true, city: true }
        });
        systemContext += `\n\nAvailable Businesses:\n` + businesses.map(b => `- ${b.name} (ID: ${b.id}, City: ${b.city})`).join('\n');
        const payload = {
            model: 'qwen-turbo',
            input: {
                messages: [
                    { role: 'system', content: systemContext },
                    { role: 'user', content: query }
                ]
            },
            parameters: {
                result_format: 'message'
            }
        };
        const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', payload, {
            headers: {
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        let aiMessage = "I'm sorry, I couldn't process your request.";
        let proposal = null;
        if (response.data?.output?.choices?.length > 0) {
            aiMessage = response.data.output.choices[0].message.content.trim();
            // Try to parse JSON block from AI output
            const jsonMatch = aiMessage.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    proposal = JSON.parse(jsonMatch[1]);
                    aiMessage = aiMessage.replace(jsonMatch[0], '').trim();
                }
                catch (e) {
                    console.error("Failed to parse AI proposal JSON", e);
                }
            }
        }
        res.json({ message: aiMessage, proposal });
    }
    catch (error) {
        console.error("Concierge Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to communicate with AI Concierge." });
    }
};
exports.handleConciergeQuery = handleConciergeQuery;
//# sourceMappingURL=ai.controller.js.map