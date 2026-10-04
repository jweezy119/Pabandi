import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { requireCrmContext } from '../middleware/crmContext.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import jwt, { type Secret } from 'jsonwebtoken';

// Read the same way auth.controller does, rather than via a shared config module: the
// signing inputs live in exactly one place already, and duplicating that is how the two
// halves drift.
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
import {
  enrollBusiness,
  addEmployee,
  getEmployees,
  addClient,
  getClients,
  createJob,
  assignEmployee,
  updateJobStatus,
  getJobs,
  recordPayroll,
  getPayrollHistory,
  recordExpense,
  getExpenses,
  getDashboardStats,
  getDeals,
  createDeal,
  updateDeal,
  deleteDeal,
} from '../services/crm.service';

// ─── Enroll Business ─────────────────────────────────────────────────────────

export async function enrollBusinessHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessName, ownerEmail, ownerName, serviceType, phone, address } = req.body;
    // Enrollment is authenticated but not yet business-scoped, so the owner is
    // taken from the token rather than the body.
    const ownerId = req.user?.id;
    if (!ownerId) throw new CustomError('Authentication required', 401);
    const business = await enrollBusiness({
      ownerId,
      businessName,
      ownerEmail: ownerEmail || req.user?.email,
      ownerName,
      serviceType,
      phone,
      address,
    });
    // REISSUE THE TOKEN.
    //
    // Nine call sites read `req.user.businessId` (invoice.routes among them), and that
    // claim is baked into the token at login. Enrollment happens AFTER login, so a user
    // who registered as a customer and then set up a business through the wizard kept a
    // token with `businessId: null` — and `POST /api/v1/invoices/:id/pay` passed that
    // null straight into Prisma:
    //
    //   Argument `businessId` must not be null.   (500)
    //
    // That is the same failure mode toggleMode already documents and fixes by
    // reissuing. Found by tests/money-flow.integration.test.ts.
    //
    // Reissuing fixes all nine consumers at once, rather than patching each one to
    // re-resolve the business. `activeBusinessId` is set alongside `businessId` because
    // that is the pair toggleMode writes and the pair the auth middleware reads.
    //
    // Sessions minted before this change still carry a null businessId and need one
    // re-login (or a mode toggle, which also reissues).
    //
    // Skipped when the service business has no linked Business row (business is
    // nullable on that model), because there is no id to put in the token and writing
    // null would reproduce the very bug this fixes.
    const businessId = business.business?.id ?? null;
    let token: string | undefined;
    if (businessId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, email: true, role: true, preferredMode: true },
      });
      token = jwt.sign(
        {
          id: ownerId,
          email: owner?.email,
          role: owner?.role,
          businessId,
          activeBusinessId: businessId,
          mode: owner?.preferredMode === 'personal' ? 'personal' : 'business',
        } as jwt.JwtPayload,
        JWT_SECRET as Secret,
        { expiresIn: JWT_EXPIRES_IN as any },
      );
    } else {
      logger.warn(
        `[CRM] enrollment for user ${ownerId} produced no Business row; token not reissued`,
      );
    }

    res.status(201).json({ success: true, data: business, token });
  } catch (error) {
    next(error);
  }
}

// ─── Employee Management ─────────────────────────────────────────────────────

export async function addEmployeeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { name, email, phone, role, payRate, payType } = req.body;
    const employee = await addEmployee(businessId, { name, email, phone, role, payRate, payType });
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const employees = await getEmployees(businessId, crm.businessId);
    res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
}

// ─── Client Management ───────────────────────────────────────────────────────

export async function addClientHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { name, email, phone, address, notes } = req.body;
    const client = await addClient(businessId, { name, email, phone, address, notes });
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
}

export async function getClientsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const clients = await getClients(businessId, crm.businessId);
    res.json({ success: true, data: clients });
  } catch (error) {
    next(error);
  }
}

// ─── Job Management ──────────────────────────────────────────────────────────

export async function createJobHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { clientId, clientName, serviceType, scheduledDate, scheduledTime, duration, durationMinutes, address, notes, price } = req.body;
    const job = await createJob(businessId, {
      clientId,
      clientName,
      serviceType,
      scheduledDate,
      scheduledTime,
      durationMinutes: durationMinutes ?? (duration ? +duration : 60),
      address,
      notes,
      price,
    });
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function assignEmployeeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: jobId } = req.params;
    const { employeeId } = req.body;
    if (!employeeId) {
      throw new CustomError('employeeId is required', 400);
    }
    const crm = requireCrmContext(req);
    const job = await assignEmployee(jobId, employeeId, crm.serviceBusinessId, crm.businessId);
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function updateJobStatusHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: jobId } = req.params;
    const { status } = req.body;
    if (!status) {
      throw new CustomError('status is required', 400);
    }
    const crm = requireCrmContext(req);
    const job = await updateJobStatus(jobId, status, crm.serviceBusinessId, crm.businessId);
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function getJobsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { dateFrom, dateTo, status, employeeId, clientId } = req.query;
    const jobs = await getJobs(businessId, {
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      status: status as string | undefined,
      employeeId: employeeId as string | undefined,
      clientId: clientId as string | undefined,
    }, crm.businessId);
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
}

// ─── Payroll Management ──────────────────────────────────────────────────────

export async function recordPayrollHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { employeeId, periodStart, periodEnd, hoursWorked, jobsCompleted, grossPay, deductions, netPay } = req.body;
    const payroll = await recordPayroll(businessId, {
      employeeId,
      periodStart,
      periodEnd,
      hoursWorked,
      jobsCompleted,
      grossPay,
      deductions,
      netPay,
    }, crm.businessId);
    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
}

export async function getPayrollHistoryHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { employeeId } = req.query;
    const payrolls = await getPayrollHistory(businessId, employeeId as string | undefined, crm.businessId);
    res.json({ success: true, data: payrolls });
  } catch (error) {
    next(error);
  }
}

// ─── Expense Management ──────────────────────────────────────────────────────

export async function recordExpenseHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { category, amount, description, date, vendor } = req.body;
    const expense = await recordExpense(businessId, { category, amount, description, date, vendor });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
}

export async function getExpensesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const { category, dateFrom, dateTo } = req.query;
    const expenses = await getExpenses(businessId, {
      category: category as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    }, crm.businessId);
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getDashboardStatsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.serviceBusinessId;
    const stats = await getDashboardStats(businessId, crm.businessId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

// ── Deal Pipeline ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/crm/deals
 *
 * Scoped from the server-resolved CRM context, so no query parameter can widen it.
 */
export async function getDealsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const deals = await getDeals(crm.serviceBusinessId, crm.businessId);
    res.json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
}

/** POST /api/v1/crm/deals */
export async function createDealHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const deal = await createDeal(crm.serviceBusinessId, crm.businessId, req.body ?? {});
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/v1/crm/deals/:id */
export async function updateDealHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const deal = await updateDeal(
      crm.serviceBusinessId,
      crm.businessId,
      req.params.id,
      req.body ?? {}
    );
    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/v1/crm/deals/:id */
export async function deleteDealHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const crm = requireCrmContext(req);
    const result = await deleteDeal(crm.serviceBusinessId, crm.businessId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
