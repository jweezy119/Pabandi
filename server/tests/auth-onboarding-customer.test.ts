import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  business: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../src/utils/database', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/services/trustPassportHelper', () => ({
  ensureTrustPassport: vi.fn(async () => ({})),
}));

import { completeOnboarding } from '../src/controllers/auth.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('POST /api/v1/auth/onboarding (completeOnboarding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists personal profile fields for CLIENT onboarding and reissues a personal-mode JWT', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-cust-1',
      trustScore: 700,
      phone: null,
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({
      id: 'user-cust-1',
      email: 'amina@pabandi.io',
      firstName: 'Amina',
      lastName: 'Khan',
      phone: '+13125550199',
      location: 'Chicago',
      username: null,
      role: 'CUSTOMER',
      profileType: 'CLIENT',
      trustScore: 700,
      disputeRate: 0,
      preferredMode: 'personal',
      business: null,
    });

    const req: any = {
      user: { id: 'user-cust-1' },
      body: {
        profileType: 'CLIENT',
        firstName: '  Amina ',
        lastName: ' Khan ',
        phone: '+13125550199',
        location: 'Chicago',
      },
    };
    const res = makeRes();
    const next = vi.fn();

    await completeOnboarding(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-cust-1' },
        data: expect.objectContaining({
          profileType: 'CLIENT',
          role: 'CUSTOMER',
          preferredMode: 'personal',
          firstName: 'Amina',
          lastName: 'Khan',
          phone: '+13125550199',
          location: 'Chicago',
        }),
      })
    );

    expect(res.json).toHaveBeenCalledTimes(1);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.user.firstName).toBe('Amina');
    expect(body.data.user.phone).toBe('+13125550199');
    expect(body.data.user.location).toBe('Chicago');
    expect(body.data.user.preferredMode).toBe('personal');
    expect(typeof body.data.token).toBe('string');

    const decoded = jwt.decode(body.data.token) as any;
    expect(decoded.mode).toBe('personal');
    expect(decoded.role).toBe('CUSTOMER');
    expect(decoded.id).toBe('user-cust-1');
  });

  it('returns 409 Conflict when the submitted phone is already linked to another user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-cust-2',
      trustScore: 700,
      phone: null,
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'other-user-99' });

    const req: any = {
      user: { id: 'user-cust-2' },
      body: {
        profileType: 'CLIENT',
        firstName: 'Bilal',
        phone: '+13125550199',
      },
    };
    const res = makeRes();
    const next = vi.fn();

    await completeOnboarding(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 when profileType is invalid', async () => {
    const req: any = {
      user: { id: 'user-cust-3' },
      body: { profileType: 'INVALID_TYPE' },
    };
    const res = makeRes();
    const next = vi.fn();

    await completeOnboarding(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
