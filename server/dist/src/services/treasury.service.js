"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTreasurySummary = exports.recordTribute = exports.TREASURY_BUCKETS = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
exports.TREASURY_BUCKETS = [
    'OPERATING',
    'TREASURY',
    'LP_PROVISION',
    'YIELD_REINVEST',
    'EMERGENCY',
];
const recordTribute = async (params) => {
    const { amount, bucket, txHash, meta } = params;
    if (!exports.TREASURY_BUCKETS.includes(bucket)) {
        throw new Error(`Invalid treasury bucket: ${bucket}`);
    }
    const result = await database_1.prisma.treasuryPosition.create({
        data: {
            bucket,
            amount,
            txHash: txHash || null,
            status: 'PENDING',
            meta: meta || undefined,
        },
        select: {
            id: true,
        },
    });
    logger_1.logger.info?.(`[Treasury] tribute recorded`, { bucket, amount, txHash });
    return result;
};
exports.recordTribute = recordTribute;
const getTreasurySummary = async () => {
    const positions = await database_1.prisma.treasuryPosition.findMany({
        select: {
            bucket: true,
            amount: true,
            meta: true,
        },
    });
    const byBucket = {};
    const byStrategy = {};
    let total = 0;
    for (const position of positions) {
        const amount = Number(position.amount || 0);
        byBucket[position.bucket] = (byBucket[position.bucket] || 0) + amount;
        total += amount;
        const meta = (position.meta || {});
        const rewardType = meta.rewardType;
        const explicitStrategy = meta.strategy;
        const inferredStrategy = explicitStrategy ||
            (rewardType === 'CONCIERGE_CASHBACK' || rewardType === 'BUSINESS_RESERVATION_HONORED'
                ? 'LP_PROVISION'
                : rewardType
                    ? 'YIELD_REINVEST'
                    : 'TREASURY');
        byStrategy[inferredStrategy] = (byStrategy[inferredStrategy] || 0) + amount;
    }
    return { total, byBucket, byStrategy };
};
exports.getTreasurySummary = getTreasurySummary;
//# sourceMappingURL=treasury.service.js.map