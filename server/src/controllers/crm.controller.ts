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
  getClient,
  updateClient,
  deleteClient,
  createJob,
  assignEmployee,
  updateJobStatus,
  getJobs,
  recordPayroll,
  getPayrollHistory,
  recordExpense,
  getExpenses,
  getDashboardStats,
  createDeal,
  getDeals,
  getDeal,
  updateDeal,
  deleteDeal,
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
  addFile,
  getFiles,
  deleteFile,
  createInvoice,
  getInvoices,
  markInvoicePaid,
} from '../services/crm.service';

// Helper to extract businessId from request (query, body, or JWT)
function getBusinessId(req: AuthRequest): string {
  const businessId = req.body?.businessId || req.query?.businessId || req.user?.businessId;
  if (!businessId) {
    throw new CustomError('businessId is required', 400);
  }
  return businessId as string;
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
    const { name, email, phone, address, notes, customData } = req.body;
    const client = await addClient(businessId, { name, email, phone, address, notes, customData });
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

export async function getClientHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = getBusinessId(req);
    const { id } = req.params;
    const client = await getClient(businessId, id);
    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
}

export async function updateClientHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = getBusinessId(req);
    const { id } = req.params;
    const { name, email, phone, address, notes, customData } = req.body;
    const client = await updateClient(businessId, id, { name, email, phone, address, notes, customData });
    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
}

export async function deleteClientHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = getBusinessId(req);
    const { id } = req.params;
    await deleteClient(businessId, id);
    res.json({ success: true, message: 'Client deleted successfully' });
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

// ─── Deal Handlers ───────────────────────────────────────────────────────────

export async function createDealHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const deal = await createDeal(businessId, req.body);
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

export async function getDealsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const { stage, clientId } = req.query;
    const deals = await getDeals(businessId, {
      stage: stage as string | undefined,
      clientId: clientId as string | undefined,
    });
    res.json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
}

export async function getDealHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const deal = await getDeal(businessId, req.params.id);
    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

export async function updateDealHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const deal = await updateDeal(businessId, req.params.id, req.body);
    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

export async function deleteDealHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    await deleteDeal(businessId, req.params.id);
    res.json({ success: true, message: 'Deal deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Activity Handlers ─────────────────────────────────────────────────────────

export async function createActivityHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const activity = await createActivity(businessId, req.body);
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
}

export async function getActivitiesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const { clientId, dealId, type } = req.query;
    const activities = await getActivities(businessId, {
      clientId: clientId as string | undefined,
      dealId: dealId as string | undefined,
      type: type as string | undefined,
    });
    res.json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
}

export async function updateActivityHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const activity = await updateActivity(businessId, req.params.id, req.body);
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
}

export async function deleteActivityHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    await deleteActivity(businessId, req.params.id);
    res.json({ success: true, message: 'Activity deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── File Handlers ─────────────────────────────────────────────────────────────

export async function addFileHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const { clientId, fileName, fileUrl, fileSize, fileType } = req.body;
    const file = await addFile(businessId, clientId, { fileName, fileUrl, fileSize, fileType });
    res.status(201).json({ success: true, data: file });
  } catch (error) {
    next(error);
  }
}

export async function getFilesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const { clientId } = req.query;
    const files = await getFiles(businessId, clientId as string);
    res.json({ success: true, data: files });
  } catch (error) {
    next(error);
  }
}

export async function deleteFileHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    await deleteFile(businessId, req.params.id);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Invoice Handlers ──────────────────────────────────────────────────────────

export async function createInvoiceHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const invoice = await createInvoice(businessId, req.body);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}

export async function getInvoicesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const { clientId, status } = req.query;
    const invoices = await getInvoices(businessId, {
      clientId: clientId as string | undefined,
      status: status as string | undefined,
    });
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
}

export async function markInvoicePaidHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const businessId = getBusinessId(req);
    const invoice = await markInvoicePaid(businessId, req.params.id);
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}

