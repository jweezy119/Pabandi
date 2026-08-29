"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.popService = exports.PopService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class PopService {
    constructor() {
        this.events = [];
    }
    async recordEvent(input) {
        const createdAt = new Date().toISOString();
        const stored = { ...input, createdAt };
        this.events.push(stored);
        if (input.eventType === 'NO_SHOW' && input.reservationId) {
            await this.attachDisputePackage(input.reservationId, stored);
        }
        return stored;
    }
    async getEventsForReservation(reservationId) {
        return this.events
            .filter(e => e.reservationId === reservationId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    async attachDisputePackage(reservationId, trigger) {
        const mapped = this.events
            .filter(e => e.reservationId === reservationId)
            .reduce((acc, ev) => {
            acc[ev.eventType + '_AT'] = ev.createdAt;
            return acc;
        }, {});
        const pkg = {
            reservationId,
            buyerIntentAt: mapped['INTENT_AT'] || undefined,
            merchantStartAt: mapped['MERCHANT_START_AT'] || undefined,
            merchantFulfillAt: mapped['MERCHANT_FULFILL_AT'] || undefined,
            noShowAt: mapped['NO_SHOW_AT'] || undefined,
            evidence: mapped,
        };
        await prisma.popEvidencePackage.create({
            data: {
                reservationId,
                evidence: pkg.evidence,
                buyerIntentAt: pkg.buyerIntentAt ? new Date(pkg.buyerIntentAt) : null,
                merchantStartAt: pkg.merchantStartAt ? new Date(pkg.merchantStartAt) : null,
                merchantFulfillAt: pkg.merchantFulfillAt ? new Date(pkg.merchantFulfillAt) : null,
                noShowAt: pkg.noShowAt ? new Date(pkg.noShowAt) : null,
            },
        });
        return pkg;
    }
}
exports.PopService = PopService;
exports.popService = new PopService();
//# sourceMappingURL=pop.service.js.map