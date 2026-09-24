"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerTrust = exports.LedgerTrustService = void 0;
const database_1 = require("../utils/database");
const event_bus_service_1 = require("./event-bus.service");
class LedgerTrustService {
    async enrichInvoiceWithTrust(invoiceId) {
        const invoice = await database_1.prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            return null;
        const wallet = invoice.clientId
            ? await database_1.prisma.walletPassport.findUnique({ where: { userId: invoice.clientId } })
            : null;
        return {
            ...invoice,
            clientTrustScore: wallet?.score || 0,
            clientTrustLevel: wallet?.level || 'bronze',
        };
    }
    async getInvoiceRisk(invoiceId) {
        const invoice = await database_1.prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            return 'high';
        const wallet = invoice.clientId
            ? await database_1.prisma.walletPassport.findUnique({ where: { userId: invoice.clientId } })
            : null;
        const score = wallet?.score || 0;
        if (score >= 70)
            return 'low';
        if (score >= 40)
            return 'medium';
        return 'high';
    }
    async autoEscrowOverdue() {
        const overdue = await database_1.prisma.ledgerInvoice.findMany({
            where: { status: 'overdue' },
        });
        for (const inv of overdue) {
            event_bus_service_1.eventBus.emitEvent('ledger.invoice.overdue', { invoiceId: inv.id });
        }
        return overdue;
    }
    async lowerScoreOnLatePayment(invoiceId) {
        const invoice = await database_1.prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice || !invoice.clientId)
            return null;
        event_bus_service_1.eventBus.emitEvent('trust.score.changed', {
            userId: invoice.clientId,
            delta: -2,
            reason: `Late payment on invoice ${invoice.number}`,
        });
        return { success: true };
    }
    async suggestCreditTerms(clientId) {
        const wallet = await database_1.prisma.walletPassport.findUnique({ where: { userId: clientId } });
        const score = wallet?.score || 0;
        return {
            clientId,
            score,
            terms: score >= 80 ? 'net-30' : score >= 50 ? 'net-15' : 'prepayment',
            creditLimit: score * 100,
        };
    }
    async generateTrustReport(businessId) {
        const invoices = await database_1.prisma.ledgerInvoice.findMany({ where: { businessId } });
        const expenses = await database_1.prisma.ledgerExpense.findMany({ where: { businessId } });
        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        return {
            businessId,
            totalRevenue,
            totalExpenses,
            netCashflow: totalRevenue - totalExpenses,
            invoiceCount: invoices.length,
            expenseCount: expenses.length,
        };
    }
}
exports.LedgerTrustService = LedgerTrustService;
exports.ledgerTrust = new LedgerTrustService();
//# sourceMappingURL=ledger-trust.service.js.map