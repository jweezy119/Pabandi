"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceTrustService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const event_bus_service_1 = require("./event-bus.service");
const trustAuditWriter_1 = require("./trustAuditWriter");
// Helper to compute decay factor for a paymentScore event
function paymentScoreDecayFactor(ageDays) {
    // 180-day half-life: decayFactor = 0.5^(ageDays / 180)
    return Math.pow(0.5, ageDays / 180);
}
// Map event types to deltas for paymentScore
const PAYMENT_SCORE_DELTAS = {
    'invoice.sent': 0, // log only, no score change
    'invoice.paid_on_time': 50, // positive delta
    'invoice.paid_late': -10, // negative small delta
    'invoice.overdue': -30, // negative significant delta (cron)
    'invoice.defaulted': -100, // negative significant delta
};
// Determine the paymentScore delta for an invoice status change
async function getPaymentScoreDelta(oldStatus, newStatus, timestamp, isPaidOnTime, isOverdue, isDefaulted) {
    const now = new Date();
    const ageMs = now.getTime() - timestamp.getTime();
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    let eventType;
    let baseDelta;
    // Determine event type based on status transition
    if (newStatus === 'sent' && oldStatus !== 'sent') {
        eventType = 'invoice.sent';
        baseDelta = PAYMENT_SCORE_DELTAS['invoice.sent'];
    }
    else if (newStatus === 'paid') {
        if (isPaidOnTime !== false) {
            // default to paid_on_time if not explicitly late
            eventType = 'invoice.paid_on_time';
            baseDelta = PAYMENT_SCORE_DELTAS['invoice.paid_on_time'];
        }
        else {
            eventType = 'invoice.paid_late';
            baseDelta = PAYMENT_SCORE_DELTAS['invoice.paid_late'];
        }
    }
    else if (newStatus === 'overdue') {
        eventType = 'invoice.overdue';
        baseDelta = PAYMENT_SCORE_DELTAS['invoice.overdue'];
    }
    else if (newStatus === 'defaulted') {
        eventType = 'invoice.defaulted';
        baseDelta = PAYMENT_SCORE_DELTAS['invoice.defaulted'];
    }
    else {
        // No score change for other transitions
        return { delta: 0, eventType: '' };
    }
    const decay = paymentScoreDecayFactor(ageDays);
    const delta = Math.round(baseDelta * decay);
    return { delta, eventType };
}
// Get passportId (TrustPassport id) for a client (CrmClient)
async function getPassportIdForClient(clientId) {
    // Traverse: CrmClient -> serviceBusiness -> Business -> owner -> TrustPassport (by userId)
    const client = await database_1.prisma.crmClient.findUnique({
        where: { id: clientId },
        select: { serviceBusinessId: true },
    });
    if (!client)
        return null;
    const serviceBusiness = await database_1.prisma.crmServiceBusiness.findUnique({
        where: { id: client.serviceBusinessId },
        select: { businessId: true },
    });
    if (!serviceBusiness)
        return null;
    const business = await database_1.prisma.business.findUnique({
        where: { id: serviceBusiness.businessId },
        select: { ownerId: true },
    });
    if (!business?.ownerId)
        return null;
    const trustPassport = await database_1.prisma.trustPassport.findUnique({
        where: { userId: business.ownerId },
        select: { id: true },
    });
    return trustPassport?.id ?? null;
}
// Check if an invoice event has already been recorded
async function invoiceEventExists(invoiceId, eventType) {
    const event = await database_1.prisma.invoiceTrustEvent.findFirst({
        where: { invoiceId, eventType },
    });
    return !!event;
}
// Record a new invoice event
async function recordInvoiceEvent(invoiceId, passportId, eventType) {
    await database_1.prisma.invoiceTrustEvent.create({
        data: {
            invoiceId,
            passportId,
            eventType,
            scoreBefore: previousScore,
            scoreAfter: newScore,
        },
    });
}
// Update paymentScore for a passportId with a delta, applying decay factor
async function updatePaymentScore(passportId, delta, eventType, eventTimestamp, auditComponent = 'PAYMENT_INVOICE') {
    const now = new Date();
    const ageMs = now.getTime() - eventTimestamp.getTime();
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    const passport = await database_1.prisma.trustPassport.findUnique({
        where: { id: passportId },
    });
    if (!passport) {
        logger_1.logger.error(`[InvoiceTrust] TrustPassport not found for id ${passportId}`);
        return;
    }
    const previousScore = passport.paymentScore;
    const decay = paymentScoreDecayFactor(ageDays);
    const adjustedDelta = Math.round(delta * decay);
    const newScore = Math.max(0, Math.min(1000, (previousScore ?? 500) + adjustedDelta));
    // Log audit entry
    await trustAuditWriter_1.trustAuditWriter.enqueue({
        userId: passport.userId ?? '',
        previousScore: previousScore ?? 500,
        newScore,
        changeReason: `Invoice event: ${eventType}`,
        component: auditComponent,
        severity: delta > 0 ? 'positive' : 'negative',
        weightUsed: decay,
        metadata: { invoiceEventType: eventType, ageDays },
        methodology: '1.0.0',
    });
    // Update paymentScore in TrustPassport
    await database_1.prisma.trustPassport.update({
        where: { id: passportId },
        data: { paymentScore: newScore },
    });
    logger_1.logger.info(`[InvoiceTrust] Updated paymentScore for passport ${passportId} from ${previousScore} to ${newScore} (delta=${adjustedDelta}, decay=${decay.toFixed(4)})`);
}
// Process an invoice status change
async function processInvoiceStatusChange(invoiceId, clientId, oldStatus, newStatus, timestamp, isPaidOnTime = true, isOverdue = false, isDefaulted = false) {
    // Get passportId for the client
    const passportId = await getPassportIdForClient(clientId);
    if (!passportId) {
        logger_1.logger.warn(`[InvoiceTrust] No passportId found for client ${clientId}`);
        return;
    }
    // Determine delta and event type
    const { delta, eventType } = getPaymentScoreDelta(oldStatus, newStatus, timestamp, isPaidOnTime, isOverdue, isDefaulted);
    // If no delta, skip (e.g., invoice.sent)
    if (delta === 0 && eventType !== 'invoice.sent')
        return;
    // Check idempotency
    const exists = await invoiceEventExists(invoiceId, eventType);
    if (exists) {
        logger_1.logger.info(`[InvoiceTrust] Event already recorded: invoiceId=${invoiceId}, eventType=${eventType}`);
        return;
    }
    // Record the event
    await recordInvoiceEvent(invoiceId, passportId, eventType);
    // Emit event via event bus (for other consumers)
    event_bus_service_1.eventBus.emitEvent(eventType, {
        invoiceId,
        passportId,
        clientId,
        timestamp,
        delta,
    });
    // Update paymentScore (only for events that affect score)
    if (delta !== 0) {
        await updatePaymentScore(passportId, delta, eventType, timestamp);
    }
}
exports.invoiceTrustService = {
    processInvoiceStatusChange,
};
//# sourceMappingURL=invoice-trust.service.js.map