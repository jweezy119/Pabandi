import { describe, it, expect } from 'vitest';
import {
  parsePagination,
  withTotal,
  clampPage,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../src/utils/pagination';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Every CRM list was the whole table.
 *
 * `getClients`, `getJobs`, `getDeals` and the activity list were all unbounded
 * `findMany`, and the browser paged the complete array afterwards. At a few thousand
 * clients the page stopped being usable and the database was asked for everything on
 * every load.
 *
 * The rule that matters most here is the one that is easy to get wrong: NO PARAMETER
 * MEANS NO LIMIT. Several callers pass a `clientId` and expect a small complete list —
 * the client detail page fetches that client's invoices, activities, deals and jobs in
 * parallel. Defaulting those to "first 25" would truncate them and look identical to
 * "you have 25", so the caller has to opt in.
 */

describe('parsePagination', () => {
  it('returns null when the caller did not ask for pagination', () => {
    // The backwards-compatibility guarantee. Everything that fetches a small,
    // complete list relies on it.
    expect(parsePagination({})).toBeNull();
    expect(parsePagination({ clientId: 'abc' })).toBeNull();
  });

  it('pages when given a page', () => {
    const p = parsePagination({ page: '3', limit: '25' })!;
    expect(p.skip).toBe(50);
    expect(p.take).toBe(25);
    expect(p.applied).toBe(true);
  });

  it('caps the limit rather than trusting it', () => {
    expect(parsePagination({ page: '1', limit: '100000' })!.take).toBe(MAX_LIMIT);
  });

  it('falls back to a default limit rather than to unlimited', () => {
    // This is the bug the whole util exists to prevent: a paginated request with no
    // limit must not become "all of them" again.
    expect(parsePagination({ page: '1' })!.take).toBe(DEFAULT_LIMIT);
  });

  it('never produces a negative offset', () => {
    expect(parsePagination({ page: '0', limit: '25' })!.skip).toBe(0);
    expect(parsePagination({ page: '-4', limit: '25' })!.skip).toBe(0);
  });

  it('survives junk without throwing or going unlimited', () => {
    const p = parsePagination({ page: 'abc', limit: 'NaN' })!;
    expect(p.skip).toBe(0);
    expect(p.take).toBe(DEFAULT_LIMIT);
  });

  it('treats a zero or negative limit as the default, not as unlimited', () => {
    expect(parsePagination({ limit: '0' })!.take).toBe(DEFAULT_LIMIT);
    expect(parsePagination({ limit: '-10' })!.take).toBe(DEFAULT_LIMIT);
  });
});

describe('withTotal', () => {
  it('reports the whole result set, not the page', () => {
    const p = parsePagination({ page: '2', limit: '25' })!;
    expect(withTotal(p, 1284)).toEqual({ page: 2, limit: 25, total: 1284, totalPages: 52 });
  });

  it('reports one page for an empty result rather than zero', () => {
    // Zero pages would disable every navigation control on the table.
    expect(withTotal(parsePagination({ page: '1', limit: '25' })!, 0).totalPages).toBe(1);
  });
});

describe('clampPage', () => {
  it('pulls a user off a page that no longer exists', () => {
    // Deleting the last row on page 5 of 5 otherwise leaves them on an empty page with
    // no explanation and a working Prev button — a dead end.
    expect(clampPage(5, 4)).toBe(4);
  });

  it('leaves a valid page alone', () => {
    expect(clampPage(2, 5)).toBe(2);
    expect(clampPage(1, 1)).toBe(1);
  });

  it('never returns below one', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });
});

describe('the response contract', () => {
  const controller = readFileSync(
    resolve(__dirname, '../../src/controllers/crm.controller.ts'),
    'utf8',
  );

  it('adds pagination alongside data rather than replacing it', () => {
    // Every existing consumer reads `.data`. Replacing the shape would break the
    // dashboard, the client dropdowns and the wizard in one go.
    expect(controller).toMatch(/data: clients/);
    expect(controller).toMatch(/pagination: pagination\s*\?\s*withTotal/);
  });

  it('sends null when the caller did not paginate', () => {
    expect(controller).toMatch(/:\s*null,?\s*$/m);
  });
});

/** Source with comments stripped: prose describing the old N+1 is not a query. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('getClients no longer does an N+1', () => {
  const service = code(readFileSync(resolve(__dirname, '../../src/services/crm.service.ts'), 'utf8'));

  it('fetches jobs once for the page, not once per client', () => {
    const fn = service.slice(service.indexOf('export async function getClients('));
    const body = fn.slice(0, fn.indexOf('\nexport '));
    const jobQueries = (body.match(/prisma\.crmJob\.findMany/g) || []).length;

    // One query, scoped to the ids on this page. The old version ran one per client,
    // so a 500-client tenant meant 501 queries on every dashboard load.
    expect(jobQueries).toBe(1);
    expect(body).toMatch(/clientId: \{ in: clientIds \}/);
  });

  it('still computes a stage for every client', () => {
    const fn = service.slice(service.indexOf('export async function getClients('));
    expect(fn.slice(0, 4000)).toMatch(/getClientStage\(/);
  });

  it('whitelists the sort column', () => {
    const fn = service.slice(service.indexOf('export async function getClients('));
    // It reaches orderBy directly, so an unknown value from a dropdown is a Prisma
    // error rather than a wrong order.
    expect(fn.slice(0, 4000)).toMatch(/CLIENT_SORT_COLUMNS\.includes\(options\.sortBy\)/);
  });

  it('searches phone, which the old client-side box ignored', () => {
    const fn = service.slice(service.indexOf('export async function getClients('));
    expect(fn.slice(0, 4000)).toMatch(/phone: \{ contains: term/);
  });
});

describe('the table hands search and sort to the server', () => {
  const table = readFileSync(
    resolve(__dirname, '../../../client/src/pages/crm/components/ClientListTable.tsx'),
    'utf8',
  );

  it('does not filter or re-sort when the server is driving', () => {
    // Reordering a page locally produces a table that looks sorted for one screen and
    // is not sorted once you page on.
    expect(table).toMatch(/if \(serverDriven\) return clients/);
  });

  it('maps UI columns onto real columns before asking for a sort', () => {
    expect(table).toMatch(/col === 'contact' \? 'email' : col === 'ltv' \? 'totalSpent' : col/);
  });

  it('still works without the new props', () => {
    // Optional, so every other caller of this table keeps working.
    expect(table).toMatch(/serverDriven = Boolean\(onQueryChange\)/);
  });
});