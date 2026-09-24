"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeCollectionService = exports.FeeCollectionService = void 0;
/**
 * feeCollection.service.ts — Unified on-chain platform-fee collector (SOL).
 *
 * Pabandi collects the platform fee ON-CHAIN in SOL (Solana-native). SOL is both the
 * gas and the fee token; the escrowed booking value can be PAB/USDC/SOL — the fee is
 * always skimmed in SOL at charge time and recorded in ONE canonical ledger row so the
 * economy dashboard can report real USD revenue regardless of the collection token.
 *
 * Every fee → a TreasuryPosition:
 *   bucket: 'TREASURY'
 *   amount: fee in SOL
 *   meta:   { asset:'SOL', source:'PLATFORM_FEE', usdValue, bookingRef, payerAddress, txHash }
 * Fails closed: if the DB write throws, the error propagates (we never silently drop revenue).
 */
const database_1 = require("../utils/database");
const tokenomics_1 = require("../config/tokenomics");
const logger_1 = require("../utils/logger");
class FeeCollectionService {
    /** Record a SOL platform fee as one canonical TreasuryPosition (USD-valued). */
    async recordSolFee(input) {
        const usdValue = +(input.amountSol * tokenomics_1.SOL_USD_PRICE).toFixed(4);
        const row = await database_1.prisma.treasuryPosition.create({
            data: {
                bucket: 'TREASURY',
                amount: input.amountSol,
                txHash: input.txHash || null,
                status: 'DEPLOYED',
                meta: {
                    asset: 'SOL',
                    source: 'PLATFORM_FEE',
                    feeSource: input.source,
                    usdValue,
                    bookingRef: input.bookingRef,
                    payerAddress: input.payerAddress || null,
                    note: 'On-chain SOL platform fee',
                    onChain: input.onChain ?? !!input.txHash,
                },
            },
        });
        logger_1.logger.info(`[FeeCollection] SOL fee ${input.amountSol} SOL ($${usdValue}) recorded for ${input.bookingRef} [${input.source}]`);
        return { id: row.id, usdValue };
    }
    /** Total SOL platform fees collected (optionally since a date), with USD value. */
    async totalSolFees(sinceDays = 30) {
        const since = new Date(Date.now() - sinceDays * 86400000);
        const rows = await database_1.prisma.treasuryPosition.findMany({
            where: { meta: { path: ['source'], equals: 'PLATFORM_FEE' }, createdAt: { gte: since } },
        });
        let totalSol = 0, totalUsd = 0, onChainSol = 0, onChainUsd = 0, accruedSol = 0, accruedUsd = 0;
        for (const r of rows) {
            const amt = r.amount || 0;
            const usd = r.meta?.usdValue || 0;
            const on = r.meta?.onChain === true;
            totalSol += amt;
            totalUsd += usd;
            if (on) {
                onChainSol += amt;
                onChainUsd += usd;
            }
            else {
                accruedSol += amt;
                accruedUsd += usd;
            }
        }
        return {
            totalSol: +totalSol.toFixed(6), totalUsd: +totalUsd.toFixed(2), count: rows.length,
            onChainSol: +onChainSol.toFixed(6), onChainUsd: +onChainUsd.toFixed(2),
            accruedSol: +accruedSol.toFixed(6), accruedUsd: +accruedUsd.toFixed(2),
        };
    }
}
exports.FeeCollectionService = FeeCollectionService;
exports.feeCollectionService = new FeeCollectionService();
//# sourceMappingURL=feeCollection.service.js.map