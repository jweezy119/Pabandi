"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actusEngine = exports.ActusEngine = void 0;
/**
 * actusEngine.service.ts — ACTUS-aligned cashflow schedule for tokenized rent streams.
 *
 * Pabandi Protocol v2.0 Pillar 4: rent contracts are mapped to the ACTUS financial
 * standard (initial exchange, periodic payments, fees, redemption) so they are
 * recognizable financial instruments for banks/regulators. This generates the contract's
 * expected cashflow schedule and anchors its hash on Solana (chain untouched — we only
 * commit the schedule hash; a future ACTUSRentPool.sol / Anchor program would enforce it).
 *
 * ACTUS event types modeled: INITIAL_EXCHANGE, PAYMENT, FEE, REDEMPTION.
 * Real, deterministic math — no simulation flag needed for the schedule itself.
 */
const solanaAnchor_service_1 = require("./solanaAnchor.service");
const logger_1 = require("../utils/logger");
class ActusEngine {
    /**
     * Build an ACTUS cashflow schedule for a tokenized rent stream.
     * INITIAL_EXCHANGE (rent in), 11 PAYMENTs (yield distributions, 50/50 split),
     * FEE (platform spread), REDEMPTION (principal back at term end).
     */
    async createContract(input) {
        const apy = input.apyPct ?? 4.5; // Ondo USDY default
        const term = input.termMonths ?? 12;
        const start = input.startDate ? new Date(input.startDate) : new Date();
        const monthlyYield = (input.principalUSD * (apy / 100)) / 12;
        const tenantShare = +(monthlyYield / 2).toFixed(4); // 50/50 split
        const landlordShare = +(monthlyYield / 2).toFixed(4);
        const schedule = [];
        // INITIAL_EXCHANGE: tenant deposits rent principal into the yield RWA.
        schedule.push({
            eventType: 'INITIAL_EXCHANGE', date: start.toISOString().slice(0, 10),
            amount: -input.principalUSD, currency: 'USD', payer: input.tenantId, payee: 'OndoUSDY',
            status: 'SCHEDULED',
        });
        // 11 monthly PAYMENTs (yield split) — last month's principal handled at REDEMPTION.
        for (let m = 1; m < term; m++) {
            const d = new Date(start);
            d.setMonth(d.getMonth() + m);
            schedule.push({
                eventType: 'PAYMENT', date: d.toISOString().slice(0, 10),
                amount: +(tenantShare + landlordShare).toFixed(4), currency: 'USD',
                payer: 'OndoUSDY', payee: `${input.tenantId}+${input.landlordId}`,
                status: 'SCHEDULED',
            });
        }
        // FEE: platform spread taken from yield (1% of principal over term).
        const fee = +(input.principalUSD * 0.01).toFixed(4);
        const fd = new Date(start);
        fd.setMonth(fd.getMonth() + term);
        schedule.push({
            eventType: 'FEE', date: fd.toISOString().slice(0, 10), amount: fee, currency: 'USD',
            payer: 'OndoUSDY', payee: 'PABANDI_TREASURY', status: 'SCHEDULED',
        });
        // REDEMPTION: principal returned to tenant at term end.
        schedule.push({
            eventType: 'REDEMPTION', date: fd.toISOString().slice(0, 10), amount: input.principalUSD,
            currency: 'USD', payer: 'OndoUSDY', payee: input.tenantId, status: 'SCHEDULED',
        });
        const contractId = `act_${createHashLocal(input.tenantId + input.landlordId + input.principalUSD + start.toISOString())}`;
        const anchor = await solanaAnchor_service_1.solanaAnchor.anchorOnSolana('ACTUS_SCHEDULE', { contractId, schedule }, 'PABANDI_ACTUS');
        logger_1.logger.info(`[ACTUS] Contract ${contractId}: ${schedule.length} cashflows, principal $${input.principalUSD}, APY ${apy}%`);
        return {
            contractId, tenantId: input.tenantId, landlordId: input.landlordId,
            principalUSD: input.principalUSD, apyPct: apy, termMonths: term,
            startDate: start.toISOString().slice(0, 10), schedule, anchor, createdAt: new Date().toISOString(),
        };
    }
    /** Net present value sanity check (regulators like to see the instrument is solvent). */
    npv(contract, annualDiscount = 0.05) {
        let npv = 0;
        for (const cf of contract.schedule) {
            const t = (new Date(cf.date).getTime() - new Date(contract.startDate).getTime()) / (365 * 24 * 3600 * 1000);
            npv += cf.amount / Math.pow(1 + annualDiscount, t);
        }
        return +npv.toFixed(2);
    }
}
exports.ActusEngine = ActusEngine;
function createHashLocal(s) {
    // local import avoids top-of-file churn
    return require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 16);
}
exports.actusEngine = new ActusEngine();
//# sourceMappingURL=actusEngine.service.js.map