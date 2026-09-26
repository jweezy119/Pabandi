"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
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
        res.json({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            subtotal: invoice.subtotal,
            currency: invoice.currency || 'USDC',
            dueDate: invoice.dateDue,
            lineItems: invoice.lineItems,
            notes: invoice.notes,
            paidAt: invoice.paidAt,
            transactionHash: invoice.transactionHash,
            business: {
                name: invoice.business.name,
                logoUrl: invoice.business.logoUrl,
                solanaAddress: invoice.business.solanaAddress,
            },
            clientName: invoice.client?.name,
        });
    }
    catch (err) {
        logger_1.logger.error(`[InvoicePublic] Error fetching invoice: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});
exports.default = router;
//# sourceMappingURL=invoicePublic.routes.js.map