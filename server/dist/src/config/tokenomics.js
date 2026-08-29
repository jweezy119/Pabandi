"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBookingEconomics = exports.computeBurn = exports.computeFee = exports.SOL_FEE_PER_BOOKING = exports.PAB_USD_PRICE = exports.SOL_USD_PRICE = exports.PASSPORT_MAX_ISSUES_PER_DAY = exports.PAB_FEE_PER_PASSPORT = exports.PAB_FEE_PER_CHECK = exports.TOKENOMICS = void 0;
/**
 * Centralized $PAB tokenomics levers.
 * Tuned for: real revenue (value-based fee), gentle deflation (burn),
 * and controlled utilization (proceeds allocated to product-driving buckets).
 *
 * Fee = FEE_RATE of booking value (with MIN_FEE_PAB floor for micro-bookings).
 * Of the fee: BURN_SHARE is burned (deflation); the remainder is split across
 * treasury buckets that fund the actual rails (LP liquidity, yield, ops, reserve).
 */
const database_1 = require("../utils/database");
const treasury_service_1 = require("../services/treasury.service");
const logger_1 = require("../utils/logger");
exports.TOKENOMICS = {
    /** Platform fee on booking value. 2% — below Stripe (2.9%+) and far below Upwork (10-20%). */
    FEE_RATE: 0.02,
    /** Floor so tiny bookings still cover gas + are economically meaningful. */
    MIN_FEE_PAB: 1,
    /** Share of the fee permanently burned (deflation). ~0.24%/yr of ~1B supply at scale. */
    BURN_SHARE: 0.12,
    /** Allocation of the post-burn fee across treasury buckets (sums to 1.0). */
    ALLOCATION: {
        LP_PROVISION: 0.35, // fund off-ramp / payout liquidity → rails actually work
        OPERATING: 0.25, // runway + control
        YIELD_REINVEST: 0.25, // compound treasury growth → utilization of capital
        EMERGENCY: 0.15, // reserve / safety → control
    },
    /** Notional PAB value of one simulated self-economy booking (demo visibility). */
    SIM_BOOKING_VALUE_PAB: 1000,
    /** Flat $PAB fee to run one background check (anti-abuse monetization). */
    PAB_FEE_PER_CHECK: 5,
};
/** Flat $PAB fee to run one background check (anti-abuse monetization). */
exports.PAB_FEE_PER_CHECK = 5;
/** Flat $PAB fee to issue one Agent Capability Passport (the metered economic event). */
exports.PAB_FEE_PER_PASSPORT = 2;
/** Foolproof abuse cap: max Agent Passport issues per owner per day. */
exports.PASSPORT_MAX_ISSUES_PER_DAY = 50;
/** Reference USD price of 1 SOL for USD-denominated fee reporting (configurable). */
exports.SOL_USD_PRICE = Number(process.env.SOL_USD_PRICE || 140);
/** Reference USD price of 1 $PAB for USD-denominated fee reporting. */
exports.PAB_USD_PRICE = 0.10;
/** On-chain SOL platform fee per booking (gas + fee are both SOL). */
exports.SOL_FEE_PER_BOOKING = Number(process.env.SOL_FEE_PER_BOOKING || 0.0005);
/** Fee for a booking of `amountPab` (value-based, with floor). */
const computeFee = (amountPab) => {
    const raw = amountPab * exports.TOKENOMICS.FEE_RATE;
    return Math.max(exports.TOKENOMICS.MIN_FEE_PAB, Math.round(raw));
};
exports.computeFee = computeFee;
/** Deflationary burn for a given fee. */
const computeBurn = (fee) => +(fee * exports.TOKENOMICS.BURN_SHARE).toFixed(2);
exports.computeBurn = computeBurn;
/**
 * Records the full economic footprint of one booking fee:
 *  - BURN (deflation) as an AgentTransaction
 *  - the post-burn remainder allocated across treasury buckets (LP/OPS/YIELD/EMERGENCY)
 *    as treasuryPositions, so the Economy dashboard shows real utilization + control.
 */
const recordBookingEconomics = async (params) => {
    const { agentId, fromAddress, fee } = params;
    const burnPab = (0, exports.computeBurn)(fee);
    const netFee = +(fee - burnPab).toFixed(2);
    try {
        // Deflationary burn
        await database_1.prisma.agentTransaction.create({
            data: {
                agentId: null,
                type: 'BURN',
                amount: burnPab,
                fromAddress,
                toAddress: 'burn',
                metadata: { agentId },
            },
        });
        // Fee collected (net of burn) — feeds /economy/stats feesCollected
        await database_1.prisma.agentTransaction.create({
            data: {
                agentId: null,
                type: 'FEE_COLLECTION',
                amount: netFee,
                fromAddress,
                toAddress: process.env.PABANDI_TREASURY_WALLET || 'treasury',
                metadata: { agentId },
            },
        });
        // Allocate the net fee across product-driving buckets
        for (const [bucket, share] of Object.entries(exports.TOKENOMICS.ALLOCATION)) {
            const amount = +(netFee * share).toFixed(2);
            if (amount <= 0)
                continue;
            await (0, treasury_service_1.recordTribute)({
                amount,
                bucket: bucket,
                meta: { type: 'BOOKING_FEE', source: fromAddress },
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('[Tokenomics] booking economics record skipped:', err.message);
    }
};
exports.recordBookingEconomics = recordBookingEconomics;
//# sourceMappingURL=tokenomics.js.map