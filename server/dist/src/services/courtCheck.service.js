"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courtCheckService = void 0;
exports.screenParty = screenParty;
exports.screenReservation = screenReservation;
const database_1 = require("../utils/database");
const courtListener_service_1 = require("./osint/courtListener.service");
const logger_1 = require("../utils/logger");
// Maps a CourtListener eviction/litigation finding to a rental risk band and the
// corresponding SecurityDeposit reduction (mirrors the A–E PTP band logic already
// used elsewhere: a worse band => larger deposit to protect the counterparty).
const BAND_REDUCTION = {
    LOW: 0, // clean record — no extra deposit
    MEDIUM: 0.1, // some housing/litigation history — +10% deposit
    HIGH: 0.25, // recent eviction — +25% deposit
};
/**
 * Run a CourtListener eviction/litigation screen, persist the result to CourtCheck,
 * and return the structured finding. Safe to call fire-and-forget from booking flows.
 */
async function screenParty(params) {
    const { subjectType, name, state, reservationId, businessId, customerId } = params;
    const cleanName = (name || '').trim();
    const fallback = {
        subjectType,
        name: cleanName,
        state,
        found: false,
        count: 0,
        recentEviction: false,
        riskBand: 'LOW',
        reductionPct: 0,
        cases: [],
    };
    if (cleanName.length < 2)
        return fallback;
    const hasKey = !!process.env.COURTLISTENER_API_KEY || !!process.env.COURTLISTENER_API_KEYS;
    if (!hasKey) {
        logger_1.logger.warn('[CourtCheck] skipping — COURTLISTENER_API_KEY not set');
        return fallback;
    }
    try {
        const comprehensive = await courtListener_service_1.courtListenerService.comprehensiveCheck(cleanName, { state });
        const riskBand = comprehensive.riskBand;
        const result = {
            subjectType,
            name: cleanName,
            state,
            found: comprehensive.totalCases > 0,
            count: comprehensive.totalCases,
            recentEviction: comprehensive.recentEviction,
            riskBand,
            reductionPct: BAND_REDUCTION[riskBand],
            cases: comprehensive.cases,
        };
        const saved = await database_1.prisma.courtCheck.create({
            data: {
                subjectType,
                name: cleanName,
                state: state || null,
                found: comprehensive.totalCases > 0,
                count: comprehensive.totalCases,
                recentEviction: comprehensive.recentEviction,
                riskBand,
                cases: comprehensive.cases,
                reservationId: reservationId || null,
                businessId: businessId || null,
                customerId: customerId || null,
            },
        });
        result.id = saved.id;
        logger_1.logger.info(`[CourtCheck] ${subjectType} ${cleanName} (${state || 'ALL'}) -> ${riskBand} (${comprehensive.totalCases} cases, ${comprehensive.criminalCount} criminal)`);
        return result;
    }
    catch (e) {
        logger_1.logger.error(`[CourtCheck] failed for ${cleanName}: ${e.message}`);
        return fallback;
    }
}
/**
 * Screen both parties of a reservation and return their bands + a combined
 * deposit adjustment suggestion. Fire-and-forget safe.
 */
async function screenReservation(reservationId) {
    const reservation = await database_1.prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { business: true, customer: true },
    });
    if (!reservation)
        return {};
    const [tenant, landlord] = await Promise.all([
        screenParty({
            subjectType: 'TENANT',
            name: reservation.customerName || reservation.customer?.firstName + ' ' + reservation.customer?.lastName,
            state: reservation.business?.state || undefined,
            reservationId,
            customerId: reservation.customerId,
        }),
        screenParty({
            subjectType: 'LANDLORD',
            name: reservation.business?.name || '',
            state: reservation.business?.state || undefined,
            reservationId,
            businessId: reservation.businessId,
        }),
    ]);
    // Fold the screening outcome into the reservation's trust rail so the booking
    // detail / risk UI reflects court + PK screening without a separate lookup.
    // Also adjust the held deposit upward for elevated risk (never invents a deposit
    // where none exists) and record the original so the change is transparent.
    try {
        const bands = [tenant?.riskBand, landlord?.riskBand].filter(Boolean);
        const combined = bands.includes('HIGH') ? 'HIGH' : bands.includes('MEDIUM') ? 'MEDIUM' : 'LOW';
        const depositAdjPct = combined === 'HIGH' ? 0.25 : combined === 'MEDIUM' ? 0.1 : 0;
        const updateData = {
            trustSignals: {
                ...(reservation.trustSignals || {}),
                courtScreen: {
                    tenantBand: tenant?.riskBand || 'LOW',
                    landlordBand: landlord?.riskBand || 'LOW',
                    combined,
                    depositAdjPct,
                    screenedAt: new Date().toISOString(),
                },
            },
        };
        // Apply the risk surcharge to an already-required deposit (protects hosts from no-shows).
        if (depositAdjPct > 0 && reservation.depositRequired && reservation.depositAmount) {
            const original = reservation.depositAmount;
            const adjusted = Math.round(original * (1 + depositAdjPct) * 100) / 100;
            updateData.depositAmount = adjusted;
            updateData.trustSignals.courtScreen.depositOriginal = original;
            updateData.trustSignals.courtScreen.depositAdjusted = adjusted;
        }
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: updateData,
        });
    }
    catch (e) {
        logger_1.logger.warn(`[CourtCheck] failed to persist trustSignals for ${reservationId}: ${e.message}`);
    }
    return { tenant, landlord };
}
exports.courtCheckService = { screenParty, screenReservation, BAND_REDUCTION };
//# sourceMappingURL=courtCheck.service.js.map