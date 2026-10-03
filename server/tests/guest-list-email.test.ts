import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/utils/database', () => ({ prisma: {} }));
vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// Capture what sendEmail receives, so the rendered body can be asserted without
// a mail provider or a network call.
const sent: any[] = [];
vi.mock('resend', () => ({
  Resend: class { emails = { send: vi.fn(async (a: any) => { sent.push(a); return { id: 'r1' }; }) }; },
}));

process.env.RESEND_API_KEY = 're_test';

import { emailService } from '../src/services/email.service';

const ENTRY = {
  email: 'guest@example.com',
  confirmationCode: 'GL-A1B2C3',
  date: new Date('2026-10-20T18:00:00Z'),
  partySize: 3,
  guestNames: ['Amara', 'Dev', 'Noor'],
  venue: { name: 'The Copper Room', address: '14 Lalitha Rd' },
};

describe('guest list confirmation', () => {
  it('exists — guestListService called it on every add', () => {
    // This is the bug: the method did not exist, so every add threw a TypeError
    // that the caller swallowed as a warning.
    expect(typeof (emailService as any).sendGuestListConfirmation).toBe('function');
  });

  it('renders the venue, code and party rather than a JSON dump', async () => {
    await emailService.sendGuestListConfirmation(ENTRY);
    const html = sent[0].html;
    expect(html).toContain('The Copper Room');
    expect(html).toContain('GL-A1B2C3');
    expect(html).toContain('Amara, Dev, Noor');
    // The real risk when a template is missing: renderTemplate falls back to
    // JSON.stringify(data), which still "sends" successfully.
    expect(html).not.toContain('{"to":');
  });

  it('skips rather than throwing when there is no email', async () => {
    // The call site guards on `email`, but the row is optional and this must not
    // be the thing that throws.
    const r = await emailService.sendGuestListConfirmation({ ...ENTRY, email: undefined });
    expect(r).toEqual({ skipped: true });
    expect(sent).toHaveLength(1);
  });

  it('does not throw on a sparse row', async () => {
    await expect(emailService.sendGuestListConfirmation({ email: 'x@y.com' })).resolves.toBeDefined();
  });
});
