"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = exports.createTribute = void 0;
const treasury_service_1 = require("../services/treasury.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const createTribute = async (req, res) => {
    try {
        const { amount, bucket, txHash, meta } = req.body;
        const result = await (0, treasury_service_1.recordTribute)({ amount, bucket, txHash, meta });
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('Error creating treasury tribute:', error);
        res.status(500).json({ success: false, error: error?.message || 'Failed to create treasury tribute' });
    }
};
exports.createTribute = createTribute;
const getSummary = async (_req, res) => {
    try {
        const summary = await (0, treasury_service_1.getTreasurySummary)();
        const recentPositions = await database_1.prisma.treasuryPosition.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, bucket: true, amount: true, status: true, createdAt: true },
        });
        res.json({ success: true, data: { ...summary, recentPositions } });
    }
    catch (error) {
        logger_1.logger.error('Error fetching treasury summary:', error);
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch treasury summary' });
    }
};
exports.getSummary = getSummary;
//# sourceMappingURL=treasury.controller.js.map