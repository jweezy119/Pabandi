import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The remaining `crm.service` writes and lifecycle transitions.
 *
 * Split from crm-money-writes.test.ts (which covers payroll and expenses) and from
 * crm-read-scope.test.ts (which covers the dashboard and reads). What is left here
 * is enrollment, employee/client creation, job creation and assignment, status
 * transitions, and the check-in / check-out / no-show lifecycle.
 *
 * The recurring theme, and it is the same one that produced the payroll hole: a
 * write that takes an id from the caller must confirm that id belongs to the
 * caller's business. Where a check is missing, that is called out explicitly rather
 * than assumed — a test asserting "this is fine" is worth more than no test, and a
 * test asserting a bug is not present would be worse than either.
 */

const employees: any[] = [];
const clients: any[] = [];
const jobs: any[] = [];
const payroll: any[] = [];
const expenses: any[] = [];

vi.mock('../src/utils/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ id: 'u1', email: 'owner@example.com' })) },
    crmServiceBusiness: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
    },
    business: { create: vi.fn(async () => ({ id: 'biz_1' })), findUnique: vi.fn(async () => null) },
    crmEmployee: {
      findFirst: vi.fn(async () => ({ id: 'emp_1' })),
      findMany: vi.fn(async () => employees),
      create: vi.fn(async (a: any) => { employees.push(a.data); return a.data; }),
    },
    crmClient: {
      findFirst: vi.fn(async () => ({ id: 'cli_1', name: 'Amara' })),
      findMany: vi.fn(async () => clients),
      create: vi.fn(async (a: any) => { clients.push(a.data); return a.data; }),
    },
    crmJob: {
      findFirst: vi.fn(async () => jobs[0] ?? null),
      findMany: vi.fn(async () => jobs),
      create: vi.fn(async (a: any) => { jobs.push(a.data); return a.data; }),
      update: vi.fn(async (a: any) => a.data),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    crmPayroll: { findMany: vi.fn(async () => payroll) },
    crmExpense: { findMany: vi.fn(async () => expenses) },
    crmAssignment: { create: vi.fn(async () => ({})) },
  },
}));

const emitted: any[] = [];
vi.mock('../src/services/event-bus.service', () => ({
  eventBus: {
    emitEvent: vi.fn((type: string, payload: any) => { emitted.push({ type, payload }); }),
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  enrollBusiness,
  addEmployee,
  addClient,
  createJob,
  assignEmployee,
  updateJobStatus,
  getPayrollHistory,
  getExpenses,
  getEmployees,
  findOrCreateClient,
  checkInJob,
  checkOutJob,
  handleNoShow,
} from '../src/services/crm.service';
import { prisma } from '../src/utils/database';

beforeEach(() => {
  employees.length = 0;
  clients.length = 0;
  jobs.length = 0;
  payroll.length = 0;
  expenses.length = 0;
  emitted.length = 0;

  // NOT vi.clearAllMocks(): that erases the implementations installed by the
  // vi.mock factories, so every prisma mock starts returning undefined and tests
  // fail with 'Job not found' for reasons that have nothing to do with the code.
  // clearAllMocks only clears call history; the factories are re-applied below.
  vi.clearAllMocks();
  vi.mocked(prisma.crmJob.findFirst).mockImplementation(async () => jobs[0] ?? null);
  vi.mocked(prisma.crmEmployee.findFirst).mockImplementation(async () => ({ id: 'emp_1' }));
  vi.mocked(prisma.crmClient.findFirst).mockImplementation(async () => ({ id: 'cli_1', name: 'Amara' }));
});

describe('enrollBusiness', () => {
  const BASE = {
    ownerId: 'u1',
    businessName: 'Apex Cleaning',
    ownerEmail: 'owner@example.com',
    ownerName: 'Amara',
    serviceType: 'cleaning',
  };

  it('requires an ownerId', async () => {
    await expect(enrollBusiness({ ...BASE, ownerId: '' })).rejects.toThrow(/Authentication required/);
  });

  it('refuses an ownerEmail that disagrees with the signed-in account', async () => {
    // Otherwise a caller could enroll a business under someone else's address and
    // receive its mail.
    await expect(enrollBusiness({ ...BASE, ownerEmail: 'victim@example.com' })).rejects.toThrow(/does not match/);
  });

  it('is idempotent: re-enrolling returns the existing pairing', async () => {
    vi.mocked(prisma.crmServiceBusiness.findFirst).mockResolvedValue({
      id: 'csb_1', business: { id: 'biz_existing' },
    } as never);
    const r = await enrollBusiness(BASE);
    // Forking a second Business would split the cross-layer join, which is the
    // thing this guard exists to prevent.
    expect(r.business).toEqual({ id: 'biz_existing' });
    expect(vi.mocked(prisma.business.create)).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    await expect(enrollBusiness({ ...BASE, businessName: '' })).rejects.toThrow(/required/);
  });
});

describe('addEmployee / addClient', () => {
  it('employee requires name and role', async () => {
    await expect(addEmployee('csb_1', { name: '', role: 'cleaner' })).rejects.toThrow(/required/);
    await expect(addEmployee('csb_1', { name: 'Dev', role: '' })).rejects.toThrow(/required/);
  });

  it('client requires a name', async () => {
    await expect(addClient('csb_1', { name: '' })).rejects.toThrow(/name is required/);
  });

  it('stores empty strings rather than null for optional contact fields', async () => {
    // Matches the existing rows: a business that has never given a phone must not
    // produce a row that reads differently from one edited later.
    await addEmployee('csb_1', { name: 'Dev', role: 'cleaner' });
    expect(employees[0].email).toBe('');
    expect(employees[0].phone).toBe('');
  });

  it('defaults payType to HOURLY and payRate to 0', async () => {
    await addEmployee('csb_1', { name: 'Dev', role: 'cleaner' });
    expect(employees[0].payType).toBe('HOURLY');
    expect(employees[0].payRate).toBe(0);
  });

  it('normalises optional client fields', async () => {
    await addClient('csb_1', { name: 'Amara', notes: 'VIP' });
    expect(clients[0].notes).toBe('VIP');
  });
});

describe('createJob', () => {
  const JOB = {
    clientId: 'cli_1',
    serviceType: 'cleaning',
    scheduledDate: '2026-10-20',
    scheduledTime: '10:00',
    address: '14 Lalitha Rd',
    price: 250,
  };

  it('refuses a client from another business', async () => {
    // The cross-tenant check that payroll was missing.
    vi.mocked(prisma.crmClient.findFirst).mockResolvedValue(null as never);
    await expect(createJob('csb_1', JOB, 'biz_1')).rejects.toThrow(/Client not found/);
    expect(jobs).toHaveLength(0);
  });

  it('requires the fields the job cannot be built without', async () => {
    for (const [field, label] of [['serviceType', 'serviceType'], ['scheduledDate', 'scheduledDate'], ['scheduledTime', 'scheduledTime'], ['clientId', 'clientId'], ['address', 'address']] as const) {
      await expect(createJob('csb_1', { ...JOB, [field]: '' }, 'biz_1')).rejects.toThrow(new RegExp(label));
    }
  });

  it('defaults durationMinutes to 60', async () => {
    await createJob('csb_1', JOB, 'biz_1');
    expect(jobs[0].durationMinutes).toBe(60);
  });
});

describe('assignEmployee / updateJobStatus', () => {
  it('assign refuses a job from another business', async () => {
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValue(null as never);
    await expect(assignEmployee('job_1', 'emp_1', 'csb_1', 'biz_1')).rejects.toThrow(/not found/i);
  });

  it('assign refuses an employee from another business', async () => {
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValue({ id: 'job_1' } as never);
    vi.mocked(prisma.crmEmployee.findFirst).mockResolvedValue(null as never);
    await expect(assignEmployee('job_1', 'emp_1', 'csb_1', 'biz_1')).rejects.toThrow(/not found/i);
  });

  it('status change refuses a job from another business', async () => {
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValue(null as never);
    await expect(updateJobStatus('job_1', 'COMPLETED', 'csb_1', 'biz_1')).rejects.toThrow(/not found/i);
  });
});

describe('checkInJob', () => {
  it('refuses a job that is not SCHEDULED', async () => {
    // Double check-in would otherwise write two events and two score movements.
    jobs.push({ id: 'job_1', status: 'IN_PROGRESS', clientId: 'cli_1', employeeId: null });
    await expect(checkInJob('job_1', 'u1', undefined, undefined, 'csb_1', 'biz_1')).rejects.toThrow(/not in SCHEDULED/);
    expect(emitted).toHaveLength(0);
  });

  it('refuses a job from another business', async () => {
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValue(null as never);
    await expect(checkInJob('job_1', 'u1', undefined, undefined, 'csb_1', 'biz_1')).rejects.toThrow(/not found/i);
  });

  it('emits delivery.checked_in on success', async () => {
    jobs.push({ id: 'job_1', status: 'SCHEDULED', clientId: 'cli_1', employeeId: 'emp_1' });
    await checkInJob('job_1', 'u1', undefined, undefined, 'csb_1', 'biz_1');
    // This event is what trust-core turns into a score movement; without it the
    // check-in is recorded but nobody is credited.
    expect(emitted.some((e) => e.type === 'delivery.checked_in')).toBe(true);
  });
});

describe('checkOutJob', () => {
  it('refuses a job that is not IN_PROGRESS', async () => {
    jobs.push({ id: 'job_1', status: 'SCHEDULED', clientId: 'cli_1' });
    await expect(checkOutJob('job_1', 'u1', 'csb_1', 'biz_1')).rejects.toThrow(/not in IN_PROGRESS/);
    expect(emitted).toHaveLength(0);
  });

  it('emits a delivery outcome that the score actually consumes', async () => {
    jobs.push({ id: 'job_1', status: 'IN_PROGRESS', clientId: 'cli_1', checkedInAt: new Date(), durationMinutes: 60 });
    await checkOutJob('job_1', 'u1', 'csb_1', 'biz_1');
    const types = emitted.map((e) => e.type);
    // These three were emitted into a void before dd4973a0d.
    expect(types.some((t) => t === 'delivery.on_time' || t === 'delivery.late')).toBe(true);
  });
});

describe('handleNoShow', () => {
  it('refuses a job from another business', async () => {
    // Was findUnique by id with no tenant check: any caller could mark any job a
    // no-show and trigger the score penalty.
    vi.mocked(prisma.crmJob.findFirst).mockResolvedValue(null as never);
    await handleNoShow('job_1', 'csb_1', 'biz_1');
    expect(emitted).toHaveLength(0);
  });

  it('ignores an already-processed job rather than penalising twice', async () => {
    jobs.push({ id: 'job_1', status: 'COMPLETED', clientId: 'cli_1' });
    await handleNoShow('job_1', 'csb_1', 'biz_1');
    expect(emitted).toHaveLength(0);
  });

  it('marks a SCHEDULED past its start as missed', async () => {
    // Two days ago at 10:00 UTC, not "an hour ago at 10:00".
    //
    // composeJobStart calls setUTCHours on scheduledDate, so an hour-ago date with a
    // fixed 10:00 only lands in the past when the suite runs after 10:00 UTC. This test
    // therefore failed for a ten-hour window every day — a flake that looked like a
    // product bug in the no-show penalty, and had nothing to do with either.
    jobs.push({
      id: 'job_1',
      status: 'SCHEDULED',
      clientId: 'cli_1',
      scheduledDate: new Date(Date.now() - 2 * 86400_000),
      scheduledTime: '10:00',
    });
    await handleNoShow('job_1', 'csb_1', 'biz_1');
    expect(emitted.some((e) => e.type === 'delivery.missed')).toBe(true);
  });

  it('leaves a SCHEDULED job alone before its start time', async () => {
    // The other half of the same boundary, and equally time-of-day sensitive if written
    // carelessly: a job two days out at 10:00 UTC has not started whatever the hour.
    jobs.push({
      id: 'job_1',
      status: 'SCHEDULED',
      clientId: 'cli_1',
      scheduledDate: new Date(Date.now() + 2 * 86400_000),
      scheduledTime: '10:00',
    });
    await handleNoShow('job_1', 'csb_1', 'biz_1');
    expect(emitted.some((e) => e.type === 'delivery.missed')).toBe(false);
  });
});

describe('reads', () => {
  it('getEmployees scopes to the caller', async () => {
    await getEmployees('csb_1', 'biz_1');
    const where = JSON.stringify(vi.mocked(prisma.crmEmployee.findMany).mock.calls[0][0]);
    expect(where).toContain('csb_1');
    expect(where).toContain('biz_1');
  });

  it('findOrCreateClient returns an existing client scoped by business', async () => {
    // An UNSCOPED lookup by email would hand one business another's client, which
    // is the tenant leak this scoping exists to prevent.
    const existing = { id: 'cli_9' };
    vi.mocked(prisma.crmClient.findFirst).mockImplementation(async () => existing as never);
    const r = await findOrCreateClient('biz_1', { name: 'Amara', email: 'a@b.com' });
    expect(r).toBe(existing);
    const where = JSON.stringify(vi.mocked(prisma.crmClient.findFirst).mock.calls[0][0]);
    expect(where).toContain('biz_1');
  });

  it('findOrCreateClient creates when there is no email to match on', async () => {
    // With no email there is nothing to look up by, so it must go straight to a
    // create rather than matching some arbitrary row.
    clients.length = 0;
    const r = await findOrCreateClient('biz_1', { name: 'Walk-in' });
    expect(clients).toHaveLength(1);
    expect(r.name).toBe('Walk-in');
  });

  it('getPayrollHistory scopes to the caller', async () => {
    await getPayrollHistory('csb_1', undefined, 'biz_1');
    const where = JSON.stringify(vi.mocked(prisma.crmPayroll.findMany).mock.calls[0][0]);
    expect(where).toContain('csb_1');
    expect(where).toContain('biz_1');
  });

  it('getExpenses scopes to the caller', async () => {
    await getExpenses('csb_1', undefined, 'biz_1');
    const where = JSON.stringify(vi.mocked(prisma.crmExpense.findMany).mock.calls[0][0]);
    expect(where).toContain('csb_1');
  });
});