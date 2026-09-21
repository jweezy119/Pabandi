import { prisma } from '../utils/database';
import { eventBus } from './event-bus.service';

export class LedgerTrustService {
  async enrichInvoiceWithTrust(invoiceId: string) {
    const invoice = await prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;

    const wallet = invoice.clientId
      ? await prisma.walletPassport.findUnique({ where: { userId: invoice.clientId } })
      : null;

    return {
      ...invoice,
      clientTrustScore: wallet?.score || 0,
      clientTrustLevel: wallet?.level || 'bronze',
    };
  }

  async getInvoiceRisk(invoiceId: string) {
    const invoice = await prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return 'high' as const;

    const wallet = invoice.clientId
      ? await prisma.walletPassport.findUnique({ where: { userId: invoice.clientId } })
      : null;

    const score = wallet?.score || 0;
    if (score >= 70) return 'low' as const;
    if (score >= 40) return 'medium' as const;
    return 'high' as const;
  }

  async autoEscrowOverdue() {
    const overdue = await prisma.ledgerInvoice.findMany({
      where: { status: 'overdue' },
    });

    for (const inv of overdue) {
      eventBus.emitEvent('ledger.invoice.overdue', { invoiceId: inv.id });
    }

    return overdue;
  }

  async lowerScoreOnLatePayment(invoiceId: string) {
    const invoice = await prisma.ledgerInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || !invoice.clientId) return null;

    eventBus.emitEvent('trust.score.changed', {
      userId: invoice.clientId,
      delta: -2,
      reason: `Late payment on invoice ${invoice.number}`,
    });

    return { success: true };
  }

  async suggestCreditTerms(clientId: string) {
    const wallet = await prisma.walletPassport.findUnique({ where: { userId: clientId } });
    const score = wallet?.score || 0;

    return {
      clientId,
      score,
      terms: score >= 80 ? 'net-30' : score >= 50 ? 'net-15' : 'prepayment',
      creditLimit: score * 100,
    };
  }

  async generateTrustReport(businessId: string) {
    const invoices = await prisma.ledgerInvoice.findMany({ where: { businessId } });
    const expenses = await prisma.ledgerExpense.findMany({ where: { businessId } });

    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

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

export const ledgerTrust = new LedgerTrustService();
