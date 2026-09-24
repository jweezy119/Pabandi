"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementService = exports.SettlementService = void 0;
const database_1 = require("../utils/database");
/**
 * Pabandi Settlement Service
 * ==========================
 *
 * NEW MODEL: Profits stay in the platform wallet.
 * - Agents work on internal credits only
 * - All fees/profits compound back to platform wallet
 * - No on-chain transfers to agents
 * - Settlement just marks credits as settled in DB
 */
const SETTLEMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
class SettlementService {
    async runSettlement() {
        const result = {
            settled: 0,
            failed: 0,
            totalUsdc: 0,
            totalSolCost: 0,
            txHashes: [],
            errors: [],
        };
        try {
            // 1. Find all unsettled reward transactions
            const unsettledRewards = await database_1.prisma.rewardTransaction.findMany({
                where: {
                    status: 'CLAIMED',
                    settledAt: null,
                },
            });
            if (unsettledRewards.length === 0) {
                return result;
            }
            // 2. Sum up all profits
            let totalProfits = 0;
            for (const reward of unsettledRewards) {
                totalProfits += reward.usdValue;
            }
            // 3. Mark all as settled (profits stay in platform wallet)
            await database_1.prisma.rewardTransaction.updateMany({
                where: {
                    status: 'CLAIMED',
                    settledAt: null,
                },
                data: { settledAt: new Date() },
            });
            // 4. Record in treasury
            if (totalProfits > 0) {
                await database_1.prisma.treasuryPosition.create({
                    data: {
                        bucket: 'OPERATING',
                        amount: totalProfits,
                        status: 'CONFIRMED',
                        meta: {
                            source: 'SETTLEMENT_COMPOUND',
                            totalRewards: unsettledRewards.length,
                            totalProfits,
                            note: 'Profits retained in platform wallet - no agent payouts'
                        },
                    },
                });
            }
            result.settled = unsettledRewards.length;
            result.totalUsdc = totalProfits;
            return result;
        }
        catch (err) {
            result.errors.push(`Settlement failed: ${err.message}`);
            return result;
        }
    }
    startPeriodicSettlement() {
        this.runSettlement().then(result => {
            if (result.settled > 0) {
                console.log(`[Settlement] Settled ${result.settled} rewards, $${result.totalUsdc.toFixed(4)} retained in platform wallet`);
            }
        });
        return setInterval(async () => {
            const result = await this.runSettlement();
            if (result.settled > 0) {
                console.log(`[Settlement] Settled ${result.settled} rewards, $${result.totalUsdc.toFixed(4)} retained in platform wallet`);
            }
        }, SETTLEMENT_INTERVAL_MS);
    }
}
exports.SettlementService = SettlementService;
exports.settlementService = new SettlementService();
//# sourceMappingURL=settlement.service.js.map