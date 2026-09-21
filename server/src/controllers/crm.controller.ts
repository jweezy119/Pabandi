import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
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
} from '../services/crm.service';

// Helper to extract businessId from request (query or body)
function getBusinessId(req: AuthRequest): string {
  const businessId = req.body?.businessId || req.query?.businessId;
  if (!businessId) {
    throw new CustomError('businessId is required', 400);
  }
  return businessId as string;
}

async function getServiceBusinessId(businessId: string): Promise<string> {
  const crmBusiness = await prisma.crmServiceBusiness.findUnique({ where: { businessId } });
  if (!crmBusiness) {
    throw new CustomError('CRM business not found for this business', 404);
  }
  return crmBusiness.id;
}

// ─── Enroll Business ─────────────────────────────────────────────────────────

export async function enrollBusinessHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessName, ownerEmail, ownerName, serviceType, phone, address } = req.body;
    const business = await enrollBusiness({ businessName, ownerEmail, ownerName, serviceType, phone, address });
    res.status(201).json({ success: true, data: business });
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
    const businessId = getBusinessId(req);
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
    const businessId = getBusinessId(req);
    const employees = await getEmployees(businessId);
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
    const businessId = getBusinessId(req);
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
    const businessId = getBusinessId(req);
    const clients = await getClients(businessId);
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
    const businessId = getBusinessId(req);
    const { clientId, serviceType, scheduledDate, scheduledTime, duration, address, notes, price } = req.body;
    const job = await createJob(businessId, {
      clientId,
      serviceType,
      scheduledDate,
      scheduledTime,
      durationMinutes: duration ? +duration : 60,
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
    const job = await assignEmployee(jobId, employeeId);
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
    const job = await updateJobStatus(jobId, status);
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
    const businessId = getBusinessId(req);
    const { dateFrom, dateTo, status, employeeId, clientId } = req.query;
    const jobs = await getJobs(businessId, {
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      status: status as string | undefined,
      employeeId: employeeId as string | undefined,
      clientId: clientId as string | undefined,
    });
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
    const businessId = getBusinessId(req);
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
    });
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
    const businessId = getBusinessId(req);
    const { employeeId } = req.query;
    const payrolls = await getPayrollHistory(businessId, employeeId as string | undefined);
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
    const businessId = getBusinessId(req);
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
    const businessId = getBusinessId(req);
    const { category, dateFrom, dateTo } = req.query;
    const expenses = await getExpenses(businessId, {
      category: category as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });
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
    const businessId = getBusinessId(req);
    const stats = await getDashboardStats(businessId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}
