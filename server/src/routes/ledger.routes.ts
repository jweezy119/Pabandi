import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

// Invoices
router.get('/invoices', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const invoices = await prisma.ledgerInvoice.findMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invoices });
  } catch (e: any) { res.status(500).json({ error: 'Failed to list invoices' }); }
});

router.post('/invoices', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const invoice = await prisma.ledgerInvoice.create({
      data: { ...req.body, senderId: userId, status: 'DRAFT' },
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to create invoice' }); }
});

router.put('/invoices/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status } = req.body;
    const invoice = await prisma.ledgerInvoice.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, data: invoice });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update invoice status' }); }
});

// Expenses
router.get('/expenses', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const expenses = await prisma.ledgerExpense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: expenses });
  } catch (e: any) { res.status(500).json({ error: 'Failed to list expenses' }); }
});

router.post('/expenses', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const expense = await prisma.ledgerExpense.create({
      data: { ...req.body, userId },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to create expense' }); }
});

// Accounts
router.get('/accounts', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const accounts = await prisma.ledgerAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: accounts });
  } catch (e: any) { res.status(500).json({ error: 'Failed to list accounts' }); }
});

// Cash Flow
router.get('/cashflow', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';
    const now = new Date();
    const startDate = new Date();
    if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
    else startDate.setFullYear(now.getFullYear() - 1);

    const [income, expenses] = await Promise.all([
      prisma.propertyFinancial.findMany({
        where: { property: { managerId: userId }, type: 'INCOME', date: { gte: startDate } },
      }),
      prisma.propertyFinancial.findMany({
        where: { property: { managerId: userId }, type: 'EXPENSE', date: { gte: startDate } },
      }),
    ]);

    const totalIncome = income.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        period,
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        incomeCount: income.length,
        expenseCount: expenses.length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get cash flow' }); }
});

// Profit & Loss
router.get('/profit-loss', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const now = new Date();
    const startDate = new Date();
    startDate.setFullYear(now.getFullYear() - 1);

    const [income, expenses] = await Promise.all([
      prisma.propertyFinancial.findMany({
        where: { property: { managerId: userId }, type: 'INCOME', date: { gte: startDate } },
      }),
      prisma.propertyFinancial.findMany({
        where: { property: { managerId: userId }, type: 'EXPENSE', date: { gte: startDate } },
      }),
    ]);

    const totalIncome = income.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        period: 'year',
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        profitMargin: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
      },
    });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get P&L' }); }
});

export default router;
