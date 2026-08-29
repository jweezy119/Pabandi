"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEconomyStats = void 0;
const database_1 = require("../utils/database");
const treasury_service_1 = require("./treasury.service");
const logger_1 = require("../utils/logger");
/**
 * Aggregates real on-chain + simulated $PAB circulation from persisted
 * AgentTransaction rows + treasury accrual positions.
 * This is the single source of truth for the public Economy dashboard.
 */
const getEconomyStats = async () => {
    try {
        const [txAgg, poolAgg, wallets, lastBurn] = await Promise.all([
            database_1.prisma.agentTransaction.groupBy({
                by: ['type'],
                _sum: { amount: true },
                _count: { id: true },
            }),
            database_1.prisma.agentTransaction.aggregate({
                where: { type: 'POOL_FEE' },
                _sum: { amount: true },
            }),
            database_1.prisma.web3Agent.count({ where: { isActive: true } }),
            database_1.prisma.agentTransaction.findFirst({
                where: { type: 'BURN' },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            }),
        ]);
        const byType = {};
        for (const row of txAgg) {
            byType[row.type] = { sum: Number(row._sum.amount || 0), count: row._count.id };
        }
        const bookings = byType['BOOKING_PAYMENT']?.count ?? 0;
        const feesCollected = byType['FEE_COLLECTION']?.sum ?? 0;
        const burned = byType['BURN']?.sum ?? 0;
        const rewardsPaid = byType['BOOKING_PAYMENT']?.sum ?? 0;
        const poolFees = Number(poolAgg._sum.amount || 0);
        const accrual = await (0, treasury_service_1.getTreasurySummary)();
        return {
            bookings,
            feesCollected,
            burned,
            rewardsPaid,
            poolFees,
            walletsFunded: wallets,
            accrual: { total: accrual.total, byBucket: accrual.byBucket },
            lastRunAt: lastBurn?.createdAt?.toISOString() ?? null,
        };
    }
    catch (err) {
        logger_1.logger.error('[Economy] stats aggregation failed:', err.message);
        return {
            bookings: 0, feesCollected: 0, burned: 0, rewardsPaid: 0,
            poolFees: 0, walletsFunded: 0,
            accrual: { total: 0, byBucket: {} }, lastRunAt: null,
        };
    }
};
exports.getEconomyStats = getEconomyStats;
//# sourceMappingURL=economy.service.js.map