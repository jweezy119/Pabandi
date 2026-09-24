"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = exports.getGuidelines = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const getGuidelines = async (_req, res) => {
    try {
        const guidelines = {
            description: "Pabandi uses the Global Trust Protocol, an industry-agnostic Elo-based scoring algorithm.",
            baseSwing: 25,
            scoreRange: "0-100",
            contextWeights: {
                "Casual/Standard": 1.0,
                "Premium Event": 1.2,
                "High-Stakes (Medical/B2B)": 2.0
            },
            outcomes: {
                "Completed": "Expected (+)",
                "Late Cancel": "Penalized (-), but better than ghosting",
                "No Show": "Severely Penalized (--)"
            },
            philosophy: "Trust is earned. High scores are hard to maintain, but low scores can be quickly redeemed by demonstrating consistent reliability."
        };
        res.json({
            success: true,
            data: guidelines
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching reliability guidelines:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
    }
};
exports.getGuidelines = getGuidelines;
const getHistory = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { reliabilityScore: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({
            success: true,
            data: {
                currentScore: user.reliabilityScore,
                note: 'Detailed score history view is coming soon.',
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching reliability history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
};
exports.getHistory = getHistory;
//# sourceMappingURL=reliability.controller.js.map