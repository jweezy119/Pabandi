import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The search the CRM did not have.
 *
 * Every list page carried its own private search box. Two consequences: you could
 * only search the page you were already on, and the clients box matched only name,
 * email and company — so typing a phone number found nothing, silently, in a box
 * that looked like it was working.
 *
 * `GET /crm/search` is the first cross-entity search in the product, and it is what
 * makes the command palette more than a filter over a hardcoded array.
 *
 * Tenant scope is the main thing pinned here. Invoices in particular are keyed by the
 * platform `Business` while jobs and clients are keyed by either anchor, so the
 * invoice branch is the one place a missing filter would return another tenant's money
 * rather than another tenant's name.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmClient: { findMany: vi.fn() },
    crmDeal: { findMany: vi.fn() },
    crmJob: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    crmActivity: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../src/utils/database';
import { searchCrm, MIN_SEARCH_LENGTH } from '../../src/services/crmSearch.service';

const SVC = 'svc_1';
const BIZ = 'biz_1';

function args(model: string) {
  return (prisma as any)[model].findMany.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ['crmClient', 'crmDeal', 'crmJob', 'invoice', 'crmActivity']) {
    (prisma as any)[m].findMany.mockResolvedValue([]);
  }
});

describe('cross-entity CRM search', () => {
  it('does not query at all below the minimum length', async () => {
    // A one-character term matches nearly everything, so it is refused outright rather
    // than turned into a query that returns ten arbitrary rows.
    expect(MIN_SEARCH_LENGTH).toBe(2);
    expect(await searchCrm(SVC, BIZ, 'x')).toEqual([]);
    expect(prisma.crmClient.findMany).not.toHaveBeenCalled();
  });

  it('returns nothing for whitespace, which is not a search term', async () => {
    expect(await searchCrm(SVC, BIZ, '   ')).toEqual([]);
    expect(prisma.crmClient.findMany).not.toHaveBeenCalled();
  });

  it('searches phone and company on clients, which the old box silently skipped', async () => {
    await searchCrm(SVC, BIZ, '07700');
    const or = args('crmClient').where.AND[1].OR;

    expect(or).toContainEqual({ phone: { contains: '07700', mode: 'insensitive' } });
    expect(or).toContainEqual({ company: { contains: '07700', mode: 'insensitive' } });
  });

  it('matches case-insensitively everywhere', async () => {
    await searchCrm(SVC, BIZ, 'Smith');
    const or = args('crmClient').where.AND[1].OR;
    // `contains` without `mode` is case-sensitive on Postgres, so "smith" would not
    // have found "Smith" — the failure that makes search feel broken unexplainably.
    for (const clause of or) {
      const field = Object.values(clause)[0] as any;
      if (field && typeof field === 'object') expect(field.mode).toBe('insensitive');
    }
  });

  it('scopes clients, deals, jobs and activities to the caller', async () => {
    await searchCrm(SVC, BIZ, 'Ada');
    for (const model of ['crmClient', 'crmDeal', 'crmJob', 'crmActivity']) {
      const where = args(model).where;
      expect(JSON.stringify(where)).toContain(SVC);
    }
  });

  it('scopes invoices to the platform business', async () => {
    await searchCrm(SVC, BIZ, 'Ada');
    expect(args('invoice').where.businessId).toBe(BIZ);
  });

  it('returns an impossible invoice predicate with no platform business', async () => {
    await searchCrm(SVC, null, 'Ada');
    // An empty filter here would be a match-all on the money table, and a match-all on
    // revenue is the worst failure direction available.
    expect(args('invoice').where.businessId).toBe('__no_platform_business__');
  });

  it('honours a type filter and skips the others entirely', async () => {
    await searchCrm(SVC, BIZ, 'Ada', { types: ['client'] });
    expect(prisma.crmClient.findMany).toHaveBeenCalled();
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    expect(prisma.crmJob.findMany).not.toHaveBeenCalled();
  });

  it('gives every result an href that resolves to a real record', async () => {
    (prisma.crmClient.findMany as any).mockResolvedValue([
      { id: 'cli_1', name: 'Ada', email: 'ada@x.com', phone: null, company: null, status: 'ACTIVE' },
    ]);
    const [r] = await searchCrm(SVC, BIZ, 'Ada');

    expect(r.type).toBe('client');
    expect(r.href).toBe('/contact/clients/cli_1');
  });

  it('labels an invoice by number so it is recognisable in a list', async () => {
    (prisma.invoice.findMany as any).mockResolvedValue([
      { id: 'inv_1', number: 'INV-0042', status: 'paid', subtotal: 120, currency: 'USD', client: { name: 'Ada' } },
    ]);
    const [r] = await searchCrm(SVC, BIZ, 'INV');

    expect(r.title).toBe('#INV-0042');
    expect(r.href).toBe('/contact/invoices/inv_1');
  });

  it('survives a client with no email or phone', async () => {
    (prisma.crmClient.findMany as any).mockResolvedValue([
      { id: 'cli_2', name: 'Grace', email: null, phone: null, company: 'Acme', status: 'ACTIVE' },
    ]);
    const [r] = await searchCrm(SVC, BIZ, 'Grace');

    // The separator joins whatever is present, so an absent field must not leave a
    // dangling " · " in the row. With only a company, the company is the useful
    // subtitle rather than a blank.
    expect(r.subtitle).toBe('Acme');
    expect(r.subtitle).not.toContain('·');
  });
});