import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Bring-your-own SMS credentials.
 *
 * The three properties that matter, and the reason each is worth a test:
 *
 *   1. The secret is encrypted at rest and NEVER returned by the API.
 *   2. A credential is verified against the provider BEFORE it is trusted, and a failure
 *      is recorded with the provider's own reason rather than swallowed.
 *   3. Saving FAILS CLOSED when encryption is unavailable — the opposite of
 *      `square-connection.service.protectToken`, which stores the raw token and warns.
 *
 * Provider calls are mocked: this suite is about our handling of a credential, not about
 * Twilio's API.
 */

// vi.hoisted, because vi.mock factories are hoisted above module initialisation and
// cannot close over a plain `const` — the first version of this file failed with
// "Cannot access 'db' before initialization".
const { rows, db, fetchAccount } = vi.hoisted(() => {
  const rows: any[] = [];
  const db: any = {
    findUnique: vi.fn(async () => rows[0] ?? null),
    upsert: vi.fn(async (args: any) => {
      const data = args.create ?? args.update;
      const row = {
        id: 'bsp_1',
        businessId: args.where.businessId,
        provider: data.provider,
        credentials: data.credentials,
        fromNumber: data.fromNumber,
        status: data.status,
        lastError: data.lastError ?? null,
        lastVerifiedAt: data.lastVerifiedAt ?? null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date(),
      };
      rows.length = 0;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async (args: any) => {
      Object.assign(rows[0], args.data);
      return rows[0];
    }),
    deleteMany: vi.fn(async () => {
      rows.length = 0;
      return { count: 1 };
    }),
  };
  const fetchAccount = vi.fn(async () => ({ sid: 'AC_valid' }));
  return { rows, db, fetchAccount };
});

vi.mock('../src/utils/database', () => ({
  prisma: { businessSmsProvider: db },
}));
vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

vi.mock('twilio', () => ({
  default: Object.assign(
    vi.fn(() => ({ api: { v2010: { accounts: () => ({ fetch: fetchAccount }) } } })),
    {
      validateRequest: vi.fn(() => true),
      getExpectedTwilioSignature: vi.fn(() => 'sig'),
    },
  ),
}));

import {
  connectProvider,
  getProvider,
  requireCredentials,
  disconnectProvider,
  toPublicView,
} from '../src/services/sms-provider.service';
import { decrypt } from '../src/utils/encryption';

// A valid 64-char hex key, so encryption is genuinely available.
const GOOD_KEY = 'a'.repeat(64);

beforeEach(() => {
  rows.length = 0;
  db.findUnique.mockClear();
  db.upsert.mockClear();
  db.update.mockClear();
  db.deleteMany.mockClear();
  fetchAccount.mockClear();
  fetchAccount.mockResolvedValue({ sid: 'AC_valid' } as never);
  process.env.ENCRYPTION_KEY = GOOD_KEY;
  global.fetch = vi.fn(async () => ({ ok: true, text: async () => '{}' })) as never;
});

describe('connecting a provider', () => {
  it('verifies against the provider before storing, and marks it VERIFIED', async () => {
    const view = await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_valid', authToken: 'secret-token' },
    });

    expect(fetchAccount).toHaveBeenCalled();
    expect(view.status).toBe('VERIFIED');
    expect(view.lastError).toBeNull();
    expect(view.lastVerifiedAt).not.toBeNull();
  });

  it('stores the credential ENCRYPTED, never as plaintext', async () => {
    await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_valid', authToken: 'super-secret-value' },
    });

    const stored = db.upsert.mock.calls[0][0].create.credentials as string;
    expect(stored).not.toContain('super-secret-value');
    expect(stored).not.toContain('AC_valid');
    // iv:authTag:ciphertext
    expect(stored.split(':')).toHaveLength(3);
    // And it really is decryptable back to what we put in.
    const back = JSON.parse(decrypt(stored));
    expect(back.authToken).toBe('super-secret-value');
  });

  it('never returns the credential through the public view', async () => {
    const view = await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_valid', authToken: 'super-secret-value' },
    });

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('super-secret-value');
    expect(serialised).not.toContain('AC_valid');
    expect(serialised).not.toContain('credentials');
    // The from-number is safe to show — it appears on every outbound message.
    expect(view.fromNumber).toBe('+15550100');
  });

  it('records a FAILED connection with the provider’s own reason', async () => {
    fetchAccount.mockRejectedValue(Object.assign(new Error('Invalid username or password'), {}) as never);

    const view = await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_bad', authToken: 'nope' },
    });

    expect(view.status).toBe('FAILED');
    // The single most useful thing to tell someone who pasted the wrong credential.
    expect(view.lastError).toMatch(/invalid username or password/i);
    expect(view.lastVerifiedAt).toBeNull();
  });

  it('rejects a provider it does not support, and a missing from-number', async () => {
    await expect(
      connectProvider('biz_1', {
        provider: 'carrier-pigeon' as never,
        fromNumber: '+15550100',
        credentials: {},
      }),
    ).rejects.toThrow(/unsupported/i);

    await expect(
      connectProvider('biz_1', { provider: 'TWILIO', fromNumber: '  ', credentials: {} }),
    ).rejects.toThrow(/sending number is required/i);
  });

  // ── The rule that separates this from protectToken ───────────────────────
  it('REFUSES to save when encryption is unavailable', async () => {
    delete process.env.ENCRYPTION_KEY;

    await expect(
      connectProvider('biz_1', {
        provider: 'TWILIO',
        fromNumber: '+15550100',
        credentials: { accountSid: 'AC_valid', authToken: 'super-secret-value' },
      }),
    ).rejects.toThrow(/encryption is not configured/i);

    // Nothing written — not even the ciphertext-less row.
    expect(db.upsert).not.toHaveBeenCalled();
  });
});

describe('reading credentials on the send path', () => {
  it('returns the decrypted credential for a VERIFIED connection', async () => {
    await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_valid', authToken: 'secret-token' },
    });

    const { provider, creds } = await requireCredentials('biz_1');
    expect(provider).toBe('TWILIO');
    expect(creds.authToken).toBe('secret-token');
  });

  it('THROWS when nothing is connected, rather than returning null', async () => {
    // A null return would let the caller fall back to the platform's shared credentials,
    // which is how a merchant's messages end up on our bill.
    await expect(requireCredentials('biz_1')).rejects.toThrow(/no sms provider is connected/i);
  });

  it('refuses to send with an unverified credential, and says why', async () => {
    fetchAccount.mockRejectedValue(new Error('Invalid username or password') as never);
    await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_bad', authToken: 'nope' },
    });

    await expect(requireCredentials('biz_1')).rejects.toThrow(/invalid username or password/i);
  });

  it('disconnecting removes the stored ciphertext entirely', async () => {
    await connectProvider('biz_1', {
      provider: 'TWILIO',
      fromNumber: '+15550100',
      credentials: { accountSid: 'AC_valid', authToken: 'secret-token' },
    });

    await disconnectProvider('biz_1');
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz_1' } });
    // Blanking the column would leave the ciphertext sitting in the database.
    expect(db.update).not.toHaveBeenCalled();
    await expect(requireCredentials('biz_1')).rejects.toThrow(/no sms provider is connected/i);
  });
});

describe('the public view is a whitelist, not a projection', () => {
  it('carries only the four safe fields plus the from-number', () => {
    const view = toPublicView({
      provider: 'TWILIO',
      fromNumber: '+15550100',
      status: 'VERIFIED',
      lastError: null,
      lastVerifiedAt: new Date(),
      // A secret smuggled in through a wider SELECT must not survive.
      credentials: 'iv:tag:ciphertext',
      accountSid: 'AC_leak',
    } as never);

    expect(Object.keys(view).sort()).toEqual(
      ['connectedAt', 'fromNumber', 'lastError', 'lastVerifiedAt', 'provider', 'status'].sort(),
    );
  });
});
