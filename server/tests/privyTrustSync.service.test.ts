import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrivySyncError } from '../src/services/privyTrustSync.service';

/**
 * Tests for the pull-based Privy trust-band sync — the path that replaced
 * webhooks, which are Enterprise-only on this account.
 *
 * Two things are being pinned here:
 *  1. The identity guards. The endpoint accepts a Privy access token from the
 *     client, so the failure modes where a valid token could attach someone
 *     else's identity to the caller's Pabandi account must stay rejected.
 *  2. The write shape. Band, score and tier land on the SAME fields the
 *     webhook path wrote, through the shared writer, so the two paths cannot
 *     drift apart.
 */

const { prismaMock, verifyAuthTokenMock, apiGetMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    userAuthMethod: { findUnique: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    trustPassport: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  verifyAuthTokenMock: vi.fn(),
  apiGetMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    verifyAuthToken = verifyAuthTokenMock;
    api = { get: apiGetMock };
  },
}));

vi.mock('../src/utils/database', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/logger', () => ({ logger: loggerMock }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.PRIVY_APP_ID = 'cmw59gfa100870gjq9xl1wo99';
  process.env.PRIVY_APP_SECRET = 'privy_app_secret_test';

  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  prismaMock.userAuthMethod.findUnique.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.userAuthMethod.upsert.mockResolvedValue({});
  prismaMock.trustPassport.updateMany.mockResolvedValue({ count: 1 });
  apiGetMock.mockResolvedValue({ data: null });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** 4 links incl. a passkey -> Band A by the shared scoring rules. */
const BAND_A_PAYLOAD = {
  id: 'did:privy:owner-1',
  linked_accounts: [
    { type: 'email', address: 'ada@example.com' },
    { type: 'google_oauth', address: 'ada@example.com' },
    { type: 'wallet', address: 'SoMeWaLlEtAddreSS' },
    { type: 'passkey', address: 'passkey-1' },
  ],
  mfa_methods: [],
};

async function expectSyncError(promise: Promise<unknown>, statusCode: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(PrivySyncError);
  expect((err as PrivySyncError).statusCode).toBe(statusCode);
  return err as PrivySyncError;
}

describe('syncPrivyIdentityForUser — identity guards', () => {
  it('401s when Privy rejects the access token', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockRejectedValue(new Error('invalid signature'));

    await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'user-1', accessToken: 'forged' }),
      401
    );

    // Nothing may be read or written after a failed verification.
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(prismaMock.userAuthMethod.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('401s when a verified token carries no did:privy subject', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    // Verified, but not a Privy user DID — such a subject must never be used
    // as a path segment or as an identity to link.
    verifyAuthTokenMock.mockResolvedValue({ userId: '../../admin' });

    const err = await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'user-1', accessToken: 'token' }),
      401
    );
    expect(err.message).toMatch(/does not identify a user/i);
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('409s when the Privy identity already belongs to another Pabandi account', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:owner-1' });
    prismaMock.userAuthMethod.findUnique.mockResolvedValue({ userId: 'victim' });

    const err = await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'attacker', accessToken: 'token' }),
      409
    );
    expect(err.message).toMatch(/already linked to a different/i);

    // The raw user must not even be fetched, let alone scored and written.
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('409s when the identity email is already a different Pabandi account', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:owner-1' });
    apiGetMock.mockResolvedValue({ data: BAND_A_PAYLOAD });
    // The linked email resolves to someone who is not the caller.
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where?.email ? { id: 'victim' } : null)
    );

    const err = await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'attacker', accessToken: 'token' }),
      409
    );
    expect(err.message).toMatch(/already in use by another/i);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('503s when the server has no Privy credentials', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    delete process.env.PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;

    await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'user-1', accessToken: 'token' }),
      503
    );
    expect(verifyAuthTokenMock).not.toHaveBeenCalled();
  });
});

describe('syncPrivyIdentityForUser — scoring and write', () => {
  it('records the band on the caller and creates the privy link', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:owner-1' });
    apiGetMock.mockResolvedValue({ data: BAND_A_PAYLOAD });
    // No pre-existing link: this call is what mints it.
    prismaMock.userAuthMethod.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await syncPrivyIdentityForUser({
      userId: 'user-1',
      accessToken: 'token',
    });

    expect(result.band).toBe('A');
    expect(result.score).toBe(90);
    expect(result.verificationTier).toBe('BAND_A');

    // Read the raw payload, not the lossy SDK conversion.
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/users/did:privy:owner-1');

    // Same fields the webhook path wrote.
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { trustScore: 90, verificationTier: 'BAND_A' },
    });

    // The link is attached to the AUTHENTICATED user, never to a value that
    // came from the client body.
    const upsert = prismaMock.userAuthMethod.upsert.mock.calls[0][0];
    expect(upsert.create).toMatchObject({
      userId: 'user-1',
      provider: 'privy',
      providerId: 'did:privy:owner-1',
    });

    expect(prismaMock.trustPassport.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { score: 90, riskBand: 'A' },
    });
  });

  it('scores an email-only identity as Band D from the raw linked list', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:owner-1' });
    // A Band D user: email only. Confirms the scorer sees the raw linked list
    // rather than a converted subset.
    apiGetMock.mockResolvedValue({
      data: { id: 'did:privy:owner-1', linked_accounts: [{ type: 'email', address: 'a@b.c' }] },
    });

    const result = await syncPrivyIdentityForUser({ userId: 'user-1', accessToken: 'token' });

    expect(result.band).toBe('D');
    expect(result.totalLinks).toBe(1);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { trustScore: 25, verificationTier: 'BAND_D' },
    });
  });

  it('maps a Privy 404 to a 404 the client can act on', async () => {
    const { syncPrivyIdentityForUser } = await import('../src/services/privyTrustSync.service');
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:owner-1' });
    apiGetMock.mockRejectedValue({ response: { status: 404, data: { error: 'User not found' } } });

    const err = await expectSyncError(
      syncPrivyIdentityForUser({ userId: 'user-1', accessToken: 'token' }),
      404
    );
    expect(err.message).toMatch(/does not recognise/i);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
