import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ── GET /api/v1/dashboard/:businessId/today ───────────────────────────────
router.get('/:businessId/today', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.reservation.findMany({
      where: {
        businessId,
        reservationDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        customer: true,
      },
      orderBy: { reservationTime: 'asc' },
    });

    return res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        bookings: bookings.map((b: any) => ({
          id: b.id,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          customerEmail: b.customerEmail,
          time: b.reservationTime,
          status: b.status,
          notes: b.notes,
          depositAmount: b.depositAmount,
          depositPaid: b.depositPaid,
        })),
      },
    });
  } catch (err: any) {
    logger.error('[Dashboard] Today error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch today\'s bookings' });
  }
});

// ── GET /api/v1/dashboard/:businessId/calendar ────────────────────────────
router.get('/:businessId/calendar', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const bookings = await prisma.reservation.findMany({
      where: {
        businessId,
        reservationDate: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
      include: {
        customer: true,
      },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const calendar = days.map((label, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayBookings = bookings.filter((b: any) => {
        const bDate = new Date(b.reservationDate).toISOString().split('T')[0];
        return bDate === dateStr;
      });
      return {
        day: label,
        date: dateStr,
        bookings: dayBookings.map((b: any) => ({
          id: b.id,
          customerName: b.customerName,
          time: b.reservationTime,
          status: b.status,
          notes: b.notes,
        })),
      };
    });

    return res.json({ success: true, data: calendar });
  } catch (err: any) {
    logger.error('[Dashboard] Calendar error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch calendar' });
  }
});

// ── GET /api/v1/dashboard/:businessId/customers ───────────────────────────
router.get('/:businessId/customers', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;

    const customers = await prisma.cleaningCustomer.findMany({
      where: { businessId, active: true },
      orderBy: { totalSpent: 'desc' },
    });

    return res.json({
      success: true,
      data: customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        totalBookings: c.totalBookings,
        totalSpent: c.totalSpent,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error('[Dashboard] Customers error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

// ── GET /api/v1/dashboard/:businessId/employees ───────────────────────────
router.get('/:businessId/employees', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const employees = await prisma.cleaningEmployee.findMany({
      where: { businessId, active: true },
      orderBy: { name: 'asc' },
    });

    const enriched = await Promise.all(
      employees.map(async (emp: any) => {
        const jobsThisWeek = await prisma.reservation.count({
          where: {
            businessId,
            status: 'COMPLETED',
            reservationDate: {
              gte: startOfWeek,
            },
          },
        });

        return {
          id: emp.id,
          name: emp.name,
          phone: emp.phone,
          payRate: emp.payRate,
          payType: emp.payType,
          jobsThisWeek,
          estimatedEarnings: emp.payType === 'HOURLY'
            ? (jobsThisWeek * (emp.payRate || 0) * 2)
            : (jobsThisWeek * (emp.payRate || 0)),
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    logger.error('[Dashboard] Employees error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

// ── GET /api/v1/dashboard/:businessId/money ───────────────────────────────
router.get('/:businessId/money', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [weekBookings, monthBookings, expenses] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          businessId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
          reservationDate: { gte: startOfWeek },
        },
        select: { depositAmount: true },
      }),
      prisma.reservation.findMany({
        where: {
          businessId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
          reservationDate: { gte: startOfMonth },
        },
        select: { depositAmount: true },
      }),
      prisma.cleaningExpense.findMany({
        where: { businessId },
        orderBy: { date: 'desc' },
        take: 50,
      }),
    ]);

    const weeklyRevenue = weekBookings.reduce((sum: number, b: any) => sum + (b.depositAmount || 0), 0);
    const monthlyRevenue = monthBookings.reduce((sum: number, b: any) => sum + (b.depositAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

    return res.json({
      success: true,
      data: {
        weeklyRevenue,
        monthlyRevenue,
        totalExpenses,
        netProfit: monthlyRevenue - totalExpenses,
        recentExpenses: expenses.map((e: any) => ({
          id: e.id,
          category: e.category,
          amount: e.amount,
          description: e.description,
          date: e.date,
        })),
        paylioBalance: 0,
      },
    });
  } catch (err: any) {
    logger.error('[Dashboard] Money error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch financials' });
  }
});

// ── POST /api/v1/dashboard/:businessId/expense ────────────────────────────
router.post('/:businessId/expense', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const { category, amount, description, date } = req.body;

    if (!category || !amount) {
      return res.status(400).json({ success: false, error: 'Category and amount are required' });
    }

    const expense = await prisma.cleaningExpense.create({
      data: {
        businessId,
        category,
        amount: parseFloat(amount),
        description: description || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return res.status(201).json({ success: true, data: expense });
  } catch (err: any) {
    logger.error('[Dashboard] Add expense error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to add expense' });
  }
});

export default router;
