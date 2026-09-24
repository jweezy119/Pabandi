"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
// Invoices
router.get('/invoices', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const invoices = await database_1.prisma.ledgerInvoice.findMany({
            where: { OR: [{ senderId: userId }, { recipientId: userId }] },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: invoices });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to list invoices' });
    }
});
router.post('/invoices', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const invoice = await database_1.prisma.ledgerInvoice.create({
            data: { ...req.body, senderId: userId, status: 'DRAFT' },
        });
        res.status(201).json({ success: true, data: invoice });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create invoice' });
    }
});
router.put('/invoices/:id/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status } = req.body;
        const invoice = await database_1.prisma.ledgerInvoice.update({
            where: { id: req.params.id },
            data: { status },
        });
        res.json({ success: true, data: invoice });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update invoice status' });
    }
});
// Expenses
router.get('/expenses', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const expenses = await database_1.prisma.ledgerExpense.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
        });
        res.json({ success: true, data: expenses });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to list expenses' });
    }
});
router.post('/expenses', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const expense = await database_1.prisma.ledgerExpense.create({
            data: { ...req.body, userId },
        });
        res.status(201).json({ success: true, data: expense });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create expense' });
    }
});
// Accounts
router.get('/accounts', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const accounts = await database_1.prisma.ledgerAccount.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: accounts });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to list accounts' });
    }
});
// Cash Flow
router.get('/cashflow', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const period = req.query.period || 'month';
        const now = new Date();
        const startDate = new Date();
        if (period === 'week')
            startDate.setDate(now.getDate() - 7);
        else if (period === 'month')
            startDate.setMonth(now.getMonth() - 1);
        else
            startDate.setFullYear(now.getFullYear() - 1);
        const [income, expenses] = await Promise.all([
            database_1.prisma.propertyFinancial.findMany({
                where: { property: { managerId: userId }, type: 'INCOME', date: { gte: startDate } },
            }),
            database_1.prisma.propertyFinancial.findMany({
                where: { property: { managerId: userId }, type: 'EXPENSE', date: { gte: startDate } },
            }),
        ]);
        const totalIncome = income.reduce((s, p) => s + (p.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, p) => s + (p.amount || 0), 0);
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
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get cash flow' });
    }
});
// Profit & Loss
router.get('/profit-loss', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const now = new Date();
        const startDate = new Date();
        startDate.setFullYear(now.getFullYear() - 1);
        const [income, expenses] = await Promise.all([
            database_1.prisma.propertyFinancial.findMany({
                where: { property: { managerId: userId }, type: 'INCOME', date: { gte: startDate } },
            }),
            database_1.prisma.propertyFinancial.findMany({
                where: { property: { managerId: userId }, type: 'EXPENSE', date: { gte: startDate } },
            }),
        ]);
        const totalIncome = income.reduce((s, p) => s + (p.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, p) => s + (p.amount || 0), 0);
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
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get P&L' });
    }
});
exports.default = router;
//# sourceMappingURL=ledger.routes.js.map