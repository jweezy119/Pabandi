import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Payroll and expense writes.
 *
 * `recordPayroll` had no validation and no ownership check. employeeId is a real
 * FK with `onDelete: Cascade`, and the route is merely authenticated, so any
 * business could POST /crm/payroll naming ANOTHER TENANT'S employee and create a
 * cross-tenant payroll row — their employee under our serviceBusinessId, with an
 * amount they chose. It then surfaces in their employee history through the
 * relation.
 *
 * Same class as the unscoped invoice delete found earlier: the write looked
 * correct because nothing forced it to look.
 */

const employee: any = { id: 'emp_1' };
const created: any[] = [];

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmEmployee: { findFirst: vi.fn(async () => employee) },
    crmPayroll: { create: vi.fn(async (args: any) => { created.push(args); return {}; }) },
    crmExpense: { create: vi.fn(async (args: any) => { created.push(args); return {}; }) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { recordPayroll, recordExpense } from '../src/services/crm.service';
import { prisma } from '../src/utils/database';

const OK = {
  employeeId: 'emp_1',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  grossPay: 2000,
  deductions: 200,
  netPay: 1800,
};

beforeEach(() => {
  created.length = 0;
  vi.clearAllMocks();
  vi.mocked(prisma.crmEmployee.findFirst).mockResolvedValue(employee as never);
});

describe('recordPayroll — the employee must belong to this business', () => {
  it('rejects an employee from another tenant', async () => {
    vi.mocked(prisma.crmEmployee.findFirst).mockResolvedValue(null as never);
    await expect(recordPayroll('csb_1', OK, 'biz_1')).rejects.toThrow(/not found for this business/);
    // Nothing written — the whole point.
    expect(created).toHaveLength(0);
  });

  it('scopes the lookup to the caller, not a bare id', async () => {
    await recordPayroll('csb_1', OK, 'biz_1');
    const where = JSON.stringify(vi.mocked(prisma.crmEmployee.findFirst).mock.calls[0][0]);
    // Both identities present: a booking-flow employee and a Contact OS employee
    // must both be reachable, and nobody else's.
    expect(where).toContain('csb_1');
    expect(where).toContain('biz_1');
  });

  it('accepts the caller\'s own employee', async () => {
    await recordPayroll('csb_1', OK, 'biz_1');
    expect(created).toHaveLength(1);
    expect(created[0].data.employeeId).toBe('emp_1');
  });
});

describe('recordPayroll — the numbers have to be coherent', () => {
  it('rejects netPay above grossPay', async () => {
    // Not a rounding artefact: it inflates what the employee is recorded as
    // receiving relative to what was paid.
    await expect(
      recordPayroll('csb_1', { ...OK, netPay: 2500 }, 'biz_1'),
    ).rejects.toThrow(/netPay cannot exceed grossPay/);
    expect(created).toHaveLength(0);
  });

  it('rejects negative amounts', async () => {
    await expect(recordPayroll('csb_1', { ...OK, grossPay: -100 }, 'biz_1')).rejects.toThrow(/negative/);
  });

  it('rejects a missing employeeId rather than writing an orphan FK', async () => {
    await expect(
      recordPayroll('csb_1', { ...OK, employeeId: '' }, 'biz_1'),
    ).rejects.toThrow(/employeeId is required/);
  });

  it('rejects an inverted pay period', async () => {
    await expect(
      recordPayroll('csb_1', { ...OK, periodStart: '2026-09-30', periodEnd: '2026-09-01' }, 'biz_1'),
    ).rejects.toThrow(/periodEnd cannot be before periodStart/);
  });

  it('rejects an unparseable date instead of letting Prisma throw opaquely', async () => {
    await expect(
      recordPayroll('csb_1', { ...OK, periodStart: 'not-a-date' }, 'biz_1'),
    ).rejects.toThrow(/valid dates/);
  });

  it('rejects non-numeric money', async () => {
    await expect(
      recordPayroll('csb_1', { ...OK, grossPay: 'lots' as never }, 'biz_1'),
    ).rejects.toThrow(/must be numbers/);
  });

  it('accepts netPay equal to grossPay', async () => {
    // Zero deductions is legitimate; only netPay ABOVE gross is wrong.
    await expect(
      recordPayroll('csb_1', { ...OK, netPay: OK.grossPay }, 'biz_1'),
    ).resolves.toBeDefined();
  });
});

describe('recordExpense', () => {
  const EXP = { category: 'supplies', amount: 120, description: 'Cleaning stock' };

  it('rejects a negative amount', async () => {
    // A negative expense is subtracted from monthlyExpenses in the dashboard, so
    // a sign error becomes an inflated profit figure rather than a typo.
    await expect(recordExpense('csb_1', { ...EXP, amount: -50 })).rejects.toThrow(/positive/);
    expect(created).toHaveLength(0);
  });

  it('rejects zero', async () => {
    await expect(recordExpense('csb_1', { ...EXP, amount: 0 })).rejects.toThrow(/required|positive/);
  });

  it('rejects a non-numeric amount', async () => {
    await expect(recordExpense('csb_1', { ...EXP, amount: 'free' as never })).rejects.toThrow(/positive/);
  });

  it('rejects an unparseable date with an actionable message', async () => {
    await expect(recordExpense('csb_1', { ...EXP, date: 'the 3rd' })).rejects.toThrow(/valid date/);
  });

  it('still rejects missing required fields', async () => {
    await expect(recordExpense('csb_1', { ...EXP, description: '' })).rejects.toThrow(/required/);
  });

  it('accepts a normal expense', async () => {
    await expect(recordExpense('csb_1', EXP)).resolves.toBeDefined();
    expect(created).toHaveLength(1);
  });
});