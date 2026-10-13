import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The data the CRM threw away.
 *
 * ClientFormModal has rendered a Status dropdown and a Company field since it was
 * written. `addClient` destructured a fixed list of five fields — name, email,
 * phone, address, notes — and dropped the rest on the floor, so every client a
 * person marked AT_RISK was stored as ACTIVE by the schema default while the screen
 * said otherwise. `company` had no column at all.
 *
 * Alongside that, five endpoints the UI has always called were never registered:
 *
 *   GET    /crm/clients/:id    the detail page fetched it and got 404
 *   PUT    /crm/clients/:id    the inline editor PUT here, so every edit was lost
 *   DELETE /crm/clients/:id    bulk delete in the clients table
 *   PUT    /crm/deals/:id      the deal editor's verb; the server had PATCH
 *   PATCH  /crm/invoices/:id   the invoice draft editor
 *
 * A field that silently discards what someone types is worse than no field at all,
 * because it teaches them the CRM does not listen. These tests exist so it cannot
 * go back to listening selectively.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmClient: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    crmActivity: { create: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('../src/services/crm-reliability.service', () => ({ getClientStage: vi.fn() }));
vi.mock('../src/services/event-bus.service', () => ({ eventBus: { emit: vi.fn(), on: vi.fn() } }));
vi.mock('../src/services/invoiceGeneration.service', () => ({ invoiceGenerationService: {} }));
vi.mock('../src/trust/trust-core', () => ({ trustCore: { emit: vi.fn() } }));
vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '../src/utils/database';
import {
  addClient,
  updateClient,
  deleteClient,
  getClient,
  CLIENT_STATUSES,
} from '../src/services/crm.service';

const SVC = 'svc_1';
const OTHER_SVC = 'svc_2';
const CLIENT_ID = 'client_1';

/** The row create() was asked to write. */
function createdData() {
  return (prisma.crmClient.create as any).mock.calls[0][0].data;
}
/** The where/update payload of update(). */
function updatedData() {
  return (prisma.crmClient.update as any).mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.crmClient.findFirst as any).mockResolvedValue({ id: CLIENT_ID, _count: { invoices: 0, jobs: 0, deals: 0 } });
  (prisma.crmClient.create as any).mockResolvedValue({ id: CLIENT_ID });
  (prisma.crmClient.update as any).mockResolvedValue({ id: CLIENT_ID });
});

describe('a client keeps what the form collected', () => {
  it('stores the status the person chose', async () => {
    // THE regression. This used to be dropped and the schema default won.
    await addClient(SVC, { name: 'Omar Farooq', status: 'AT_RISK' });
    expect(createdData().status).toBe('AT_RISK');
  });

  it('stores the company', async () => {
    // No column existed for this. The field was rendered and silently discarded.
    await addClient(SVC, { name: 'Sara Malik', company: '  Malik Textiles  ' });
    expect(createdData().company).toBe('Malik Textiles');
  });

  it('keeps custom fields rather than dropping the whole object', async () => {
    await addClient(SVC, { name: 'Ayesha Khan', customData: { source: 'referral' } });
    expect(createdData().customData).toEqual({ source: 'referral' });
  });

  it('omits customData entirely when empty, so the column default holds', async () => {
    await addClient(SVC, { name: 'Ayesha Khan', customData: {} });
    expect('customData' in createdData()).toBe(false);
  });

  it('defaults status to ACTIVE rather than leaving it undefined', async () => {
    await addClient(SVC, { name: 'Ayesha Khan' });
    expect(createdData().status).toBe('ACTIVE');
  });

  it('trims the name', async () => {
    await addClient(SVC, { name: '  Ayesha Khan  ' });
    expect(createdData().name).toBe('Ayesha Khan');
  });

  it.each(['', '   ', undefined])('rejects the empty name %p', async (name) => {
    await expect(addClient(SVC, { name: name as any })).rejects.toThrow(/name is required/);
  });

  it('rejects a status outside the allowed set, and says what is allowed', async () => {
    // Storing "at risk" would leave the row matching no filter, so the client
    // disappears from every list the person can reach.
    await expect(addClient(SVC, { name: 'X', status: 'at risk' })).rejects.toThrow(
      new RegExp(CLIENT_STATUSES.join(', ')),
    );
  });

  it('rejects a malformed email rather than storing it for invoicing', async () => {
    await expect(addClient(SVC, { name: 'X', email: 'not-an-email' })).rejects.toThrow(/valid email/);
  });

  it('lowercases and trims a valid email', async () => {
    await addClient(SVC, { name: 'X', email: '  Sara@Example.COM ' });
    expect(createdData().email).toBe('sara@example.com');
  });

  it('accepts an empty email as null, since email is optional', async () => {
    await addClient(SVC, { name: 'X', email: '' });
    expect(createdData().email).toBe('');
  });
});

describe('editing a client', () => {
  it('writes only the fields that were sent', async () => {
    // A partial edit must not blank everything the person did not touch.
    await updateClient(SVC, CLIENT_ID, { name: 'New Name' });
    expect(updatedData()).toEqual({ name: 'New Name' });
  });

  it('writes the status on edit too', async () => {
    await updateClient(SVC, CLIENT_ID, { status: 'VIP' });
    expect(updatedData().status).toBe('VIP');
  });

  it('clears the company when it is emptied', async () => {
    // Otherwise there is no way to correct a company entered by mistake.
    await updateClient(SVC, CLIENT_ID, { company: '  ' });
    expect(updatedData().company).toBeNull();
  });

  it('rejects an unknown status on edit', async () => {
    await expect(updateClient(SVC, CLIENT_ID, { status: 'GONE' })).rejects.toThrow(/Invalid status/);
  });

  it('rejects an empty name', async () => {
    await expect(updateClient(SVC, CLIENT_ID, { name: '  ' })).rejects.toThrow(/cannot be empty/);
  });

  it('scopes the lookup to this business', async () => {
    await updateClient(SVC, CLIENT_ID, { name: 'X' });
    const where = (prisma.crmClient.findFirst as any).mock.calls[0][0].where;
    expect(where).toEqual({ id: CLIENT_ID, serviceBusinessId: SVC });
  });

  it('404s a client belonging to another business', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue(null);
    await expect(updateClient(OTHER_SVC, CLIENT_ID, { name: 'X' })).rejects.toThrow(/not found/);
    expect(prisma.crmClient.update).not.toHaveBeenCalled();
  });
});

describe('deleting a client', () => {
  it('deletes when there is nothing financial attached', async () => {
    await deleteClient(SVC, CLIENT_ID);
    expect(prisma.crmClient.delete).toHaveBeenCalledWith({ where: { id: CLIENT_ID } });
  });

  it('refuses when the client has invoices, and explains the alternative', async () => {
    // An invoice may already be paid, escrowed or reconciled. Deleting the client
    // must not take that with it, and "cannot delete" with no reason reads as a
    // broken button.
    (prisma.crmClient.findFirst as any).mockResolvedValue({
      id: CLIENT_ID, _count: { invoices: 2, jobs: 0, deals: 0 },
    });

    await expect(deleteClient(SVC, CLIENT_ID)).rejects.toThrow(/2 invoices/);
    await expect(deleteClient(SVC, CLIENT_ID)).rejects.toThrow(/INACTIVE/);
    expect(prisma.crmClient.delete).not.toHaveBeenCalled();
  });

  it('404s rather than deleting another business\'s client', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue(null);
    await expect(deleteClient(OTHER_SVC, CLIENT_ID)).rejects.toThrow(/not found/);
    expect(prisma.crmClient.delete).not.toHaveBeenCalled();
  });
});

describe('reading one client', () => {
  it('404s rather than returning another tenant\'s record', async () => {
    (prisma.crmClient.findFirst as any).mockResolvedValue(null);
    await expect(getClient(OTHER_SVC, CLIENT_ID)).rejects.toThrow(/not found/);
  });
});
/**
 * ROUTE REGISTRATION
 *
 * The service functions above were all correct before this change — `updateInvoice`
 * had existed for some time, tenant-scoped and draft-only. What was missing was the
 * route, and no unit test could see that: the suite calls service functions
 * directly, so a handler that was never registered looked identical to one that
 * worked. That is the same blind spot route-registration.test.ts documents for the
 * dead `/api/v1/whatsapp` entry.
 *
 * So these assert on the wiring itself.
 */
describe('the endpoints the UI calls are actually registered', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const crmRoutes = readFileSync(
    new URL('../src/routes/crm.routes.ts', import.meta.url), 'utf8');

  it.each([
    ['get', '/clients/:id', 'the client detail page fetches it'],
    ['put', '/clients/:id', 'the inline editor PUTs here'],
    ['delete', '/clients/:id', 'bulk delete in the clients table'],
    ['patch', '/invoices/:id', 'the invoice draft editor'],
  ])('registers %s %s — %s', (method, path, why) => {
    expect(
      crmRoutes,
      `${method.toUpperCase()} ${path} is not registered, so ${why} 404s and the edit is lost`,
    ).toMatch(new RegExp(`router\\.${method}\\('${path.replace('/', '\\/')}'`));
  });

  it('does not register a PUT for deals — the server verb is PATCH', () => {
    // The deal editor PUT here for as long as it existed. Rather than add a second
    // URL for one operation and let the two drift apart, the client was changed.
    expect(crmRoutes).not.toMatch(/router\.put\('\/deals\/:id'/);
    expect(crmRoutes).toMatch(/router\.patch\('\/deals\/:id'/);
  });
});
