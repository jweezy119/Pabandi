import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The rest of P1.
 *
 * Three gaps, all the same shape as the ones already fixed: the capability existed on
 * the server or in a component, and nothing connected them.
 *
 *   - Deals, jobs and invoices were unbounded findMany like the clients list was. The
 *     clients fix moved the N+1 and made the contract; this extends it to the other
 *     three, on the same opt-in terms.
 *   - The team directory had no search, filter or sort at all — one table, creation
 *     order — so an admin managing fifty people scrolled to find one and could not ask
 *     "who is inactive".
 *   - Invoice line items were immutable after creation. `updateInvoice` has always
 *     accepted `lineItems` and `subtotal`; the edit form only ever sent notes and
 *     dateDue, so a wrong draft could only be deleted and recreated.
 */

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const read = (p: string, root = resolve(__dirname, '../../src')) =>
  code(readFileSync(resolve(root, p), 'utf8'));

const CLIENT = resolve(__dirname, '../../../client/src');

describe('every CRM list is now paged', () => {
  const service = read('services/crm.service.ts');

  it('getDeals accepts page and returns a count', () => {
    expect(service).toMatch(/export async function getDeals\([\s\S]*?take\?: number;/);
    expect(service).toMatch(/prisma\.crmDeal\.count\(/);
  });

  it('getJobs accepts page and returns a count', () => {
    const fn = service.slice(service.indexOf('export async function getJobs('));
    expect(fn.slice(0, 600)).toMatch(/take\?: number/);
    expect(fn.slice(0, 4000)).toMatch(/prisma\.crmJob\.count\(/);
  });

  it('both are opt-in — no take means no limit', () => {
    // The client and deal detail pages fetch one record's history and render all of
    // it. An implicit page size would truncate those silently.
    const deals = service.slice(service.indexOf('export async function getDeals('));
    expect(deals.slice(0, 3000)).toMatch(/const paginated = options\.take !== undefined/);
  });

  it('invoices are paged and still searchable', () => {
    const routes = read('routes/crm.routes.ts');
    expect(routes).toMatch(/prisma\.invoice\.count\(/);
    // Paging must not cost the search that was just added.
    expect(routes).toMatch(/number: \{ contains: term, mode: 'insensitive' \}/);
  });

  it('activities are paged without changing the bare-array response shape', () => {
    const routes = read('routes/activity.routes.ts');
    expect(routes).toMatch(/prisma\.crmActivity\.count\(/);
    // `readList` exists because two shapes exist for one job. Changing this one to an
    // envelope would break every caller that reads a bare array.
    expect(routes).toMatch(/res\.json\(activities\)/);
    // So pagination rides in headers.
    expect(routes).toMatch(/X-Total-Count/);
  });

  it('deals search reaches the client, not just the title', () => {
    const service = read('services/crm.service.ts');
    const deals = service.slice(service.indexOf('export async function getDeals('));
    expect(deals.slice(0, 2500)).toMatch(/client: \{ is: \{ name: \{ contains: term/);
  });

  it('every sort column is whitelisted', () => {
    const service = read('services/crm.service.ts');
    // A sort key reaches orderBy directly; an unknown one is a Prisma error.
    expect(service).toMatch(/DEAL_SORT_COLUMNS\.includes\(options\.sortBy\)/);
    expect(service).toMatch(/JOB_SORT_COLUMNS as readonly string\[\]\)\.includes\(sortBy\)/);
  });
});

describe('the team directory can be narrowed', () => {
  const service = read('services/team.service.ts');
  const page = readFileSync(resolve(CLIENT, 'pages/crm/ContactTeamPage.tsx'), 'utf8');

  it('searches name and email', () => {
    expect(service).toMatch(/name: \{ contains: term, mode: 'insensitive' \}/);
    expect(service).toMatch(/email: \{ contains: term, mode: 'insensitive' \}/);
  });

  it('filters by role and active state', () => {
    expect(service).toMatch(/if \(options\.role\) where\.role = options\.role/);
    expect(service).toMatch(/if \(options\.isActive !== undefined\)/);
  });

  it('distinguishes an absent active filter from "false"', () => {
    // `where.isActive = undefined` is a no-op and `= false` is a filter. Collapsing
    // them would either hide everyone or filter nobody.
    expect(service).toMatch(/options\.isActive !== undefined/);
  });

  it('ignores a nonsense active filter rather than hiding everyone', () => {
    const routes = read('routes/team.routes.ts');
    expect(routes).toMatch(/isActive === 'true' \? true : isActive === 'false' \? false : undefined/);
  });

  it('offers the controls on the page', () => {
    expect(page).toMatch(/aria-label="Search team"/);
    expect(page).toMatch(/aria-label="Filter by role"/);
    expect(page).toMatch(/aria-label="Filter by status"/);
    expect(page).toMatch(/aria-label="Sort by"/);
  });

  it('reads the new envelope rather than assuming a bare array', () => {
    // The endpoint now answers { success, data, pagination }. Reading it as an array
    // set state to an object and every .map below it would throw.
    expect(page).toMatch(/setMembers\(body\.data \|\| \[\]\)/);
  });
});

describe('invoice line items are editable', () => {
  const service = read('services/invoice.service.ts');
  const editor = readFileSync(
    resolve(CLIENT, 'pages/crm/components/InvoiceLineItemsEditor.tsx'),
    'utf8',
  );
  const page = readFileSync(resolve(CLIENT, 'pages/crm/ContactInvoiceDetailPage.tsx'), 'utf8');

  it('the server already accepted them', () => {
    expect(service).toMatch(/if \(data\.lineItems\) updateData\.lineItems = data\.lineItems/);
    expect(service).toMatch(/if \(data\.subtotal !== undefined\)/);
  });

  it('the editor recomputes the subtotal rather than trusting an input', () => {
    // Subtotal is what rails and payment links derive from. A form that let someone
    // type a total which then disagreed with the lines above it would store two
    // different amounts for one invoice.
    expect(editor).toMatch(/rows\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.price\) \|\| 0\), 0\)/);
  });

  it('refuses to save an invoice with no priced line', () => {
    // A zero-line invoice is not an invoice, and one would still look payable.
    expect(editor).toMatch(/needs at least one line/);
  });

  it('refuses a negative price', () => {
    expect(editor).toMatch(/Every line needs a price of zero or more/);
  });

  it('cannot remove the last remaining row', () => {
    expect(editor).toMatch(/disabled=\{rows\.length === 1\}/);
  });

  it('sends lineItems and subtotal through the existing PATCH', () => {
    expect(page).toMatch(/JSON\.stringify\(\{ lineItems, subtotal \}\)/);
  });

  it('still refuses edits on a non-draft invoice', () => {
    // `updateInvoice` enforces this, so the editor is only reachable while it holds.
    expect(service).toMatch(/if \(invoice\.status !== 'draft'\) throw new CustomError\('Only draft invoices can be edited'/);
  });
});