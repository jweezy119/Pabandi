"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const trust_core_1 = require("../trust/trust-core");
const email_service_1 = require("../services/email.service");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/public/invoices/:invoiceId
 * Fetch invoice details for a payment link.
 * No authentication required — this is a public endpoint.
 */
router.get('/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await database_1.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                business: { select: { id: true, name: true, solanaAddress: true, logoUrl: true } },
                client: { select: { id: true, name: true, email: true } },
            },
        });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        let metadata = {};
        try {
            const parsed = JSON.parse(invoice.notes || '{}');
            metadata = parsed.metadata || {};
        }
        catch { }
        res.json({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            subtotal: invoice.subtotal,
            currency: metadata.currency || 'USDC',
            dueDate: invoice.dateDue,
            lineItems: invoice.lineItems,
            notes: invoice.notes,
            paidAt: invoice.paidAt,
            paymentLink: invoice.paymentLink,
            transactionHash: metadata.transactionHash,
            requireEscrow: metadata.requireEscrow,
            business: {
                name: invoice.business?.name,
                logoUrl: invoice.business?.logoUrl,
                solanaAddress: invoice.business?.solanaAddress,
            },
            clientName: invoice.client?.name,
        });
    }
    catch (err) {
        logger_1.logger.error(`[InvoicePublic] Error fetching invoice: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});
router.post('/:invoiceId/pay', rateLimit_middleware_1.writeLimiter, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { transactionHash } = req.body;
        // We import from invoice.service dynamically to avoid circular dependencies if any
        const { payPublicInvoice } = await Promise.resolve().then(() => __importStar(require('../services/invoice.service')));
        const updated = await payPublicInvoice(invoiceId, transactionHash);
        if (updated.client?.passportId) {
            const isLate = new Date() > new Date(updated.dateDue);
            const eventName = isLate ? 'invoice.paid_late' : 'invoice.paid_on_time';
            await trust_core_1.trustCore.emit(eventName, {
                passportId: updated.client.passportId,
                invoiceId: updated.id,
                amount: updated.subtotal,
            });
        }
        res.json(updated);
    }
    catch (err) {
        logger_1.logger.error(`[InvoicePublic] Error paying invoice: ${err.message}`);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});
router.post('/:invoiceId/claim-paid', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await database_1.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { client: true }
        });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const updated = await database_1.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'payment_claimed' },
        });
        const business = await database_1.prisma.business.findUnique({ where: { id: invoice.businessId } });
        if (business) {
            email_service_1.emailService.sendPaymentClaimed(business, updated, invoice.client);
        }
        if (invoice.client?.passportId) {
            await trust_core_1.trustCore.emit('invoice.payment_claimed', {
                passportId: invoice.client.passportId,
                invoiceId: invoice.id,
                amount: invoice.subtotal,
            });
        }
        res.json(updated);
    }
    catch (err) {
        logger_1.logger.error(`[InvoicePublic] Error claiming paid: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=invoicePublic.routes.js.map