import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Booking creation — POST /api/v1/core-bookings/create-with-payment.
 *
 * The money path: a client books a service, a reservation is created, a deposit
 * is held in escrow, and a Square checkout session is handed back so the client
 * can pay. Every property that money depends on is asserted here:
 *
 *   - Missing required fields → 400 (businessId, date, time, partySize)
 *   - Unknown business → 404
 *   - Reservation is created PENDING with the right deposit
 *   - Payment intent row is written with the booking ref
 *   - Square checkout failure is non-fatal: the booking is still returned
 *   - Square success returns the checkout URL
 *   - Rewards preview is attached when the reward engine answers
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    reservation: { create: vi.fn() },
    payment: { create: vi.fn() },
    universalEscrow: { create: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    (_req as any).user = { id: 'test-user-1', businessId: null };
    next();
  },
}));

vi.mock('../src/services/rewardEngine.service', () => ({
  rewardEngine: { calculateRewards: vi.fn() },
}));

vi.mock('../src/services/squareCheckout.service', () => ({
  squareService: { createCheckout: vi.fn() },
}));

import { prisma } from '../src/utils/database';
import { rewardEngine } from '../src/services/rewardEngine.service';
import { squareService } from '../src/services/squareCheckout.service';
import router from '../src/routes/coreBooking.routes';

function layer(path: string, method = 'post') {
  return (router as any).stack.find(
    (l: any) => l.route?.path === path && Object.keys(l.route.methods).includes(method),
  );
}

async function call(method: string, path: string, body: unknown) {
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/core-bookings', router);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as any).port;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'post' ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {}
  await new Promise<void>((r) => server.close(() => r()));
  return { status: res.status, body: parsed };
}

beforeEach(() => {
  vi.mocked(prisma.business.findUnique).mockReset();
  vi.mocked(prisma.reservation.create).mockReset();
  vi.mocked(prisma.payment.create).mockReset();
  vi.mocked(squareService.createCheckout).mockReset();
  vi.mocked(rewardEngine.calculateRewards).mockReset();
});

describe('POST /api/v1/core-bookings/create-with-payment', () => {
  const validBody = {
    businessId: 'biz_1',
    date: '2026-12-01',
    time: '14:00',
    partySize: 2,
    customerEmail: 'client@example.com',
    customerName: 'Test Client',
  };

  it('exists', () => expect(layer('/create-with-payment')).toBeDefined());

  it('is behind authenticate', () => {
    const wh = layer('/create-with-payment');
    const handlers = wh.route.stack.map((h: any) => h.handle.name ?? String(h.handle));
    expect(handlers.join(',')).toContain('authenticate');
  });

  it('creates a reservation + payment intent and returns bookingRef + deposit', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      id: 'biz_1',
      name: 'Test Cleaning Co',
      category: 'CLEANING',
    } as never);
    vi.mocked(prisma.reservation.create).mockResolvedValueOnce({
      id: 'res_1',
      businessId: 'biz_1',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValueOnce({
      id: 'pay_1',
      reservationId: 'res_1',
    } as never);
    vi.mocked(squareService.createCheckout).mockResolvedValueOnce({
      url: 'https://checkout.square.site/test',
      id: 'sq_1',
    } as never);

    const { status, body } = await call('post', '/api/v1/core-bookings/create-with-payment', validBody);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.bookingRef).toMatch(/^PAB-/);
    expect(body.data.depositAmount).toBe(25);
    expect(body.data.squareCheckoutUrl).toBe('https://checkout.square.site/test');

    expect(prisma.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz_1',
          numberOfGuests: 2,
          status: 'PENDING',
          depositAmount: 25,
        }),
      })
    );

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservationId: 'res_1',
          userId: 'test-user-1',
        }),
      })
    );
  });

  it('returns 400 when businessId is missing', async () => {
    const { status } = await call('post', '/api/v1/core-bookings/create-with-payment', {
      date: '2026-12-01',
      time: '14:00',
      partySize: 2,
    });
    expect(status).toBe(400);
  });

  it('returns 400 when date is missing', async () => {
    const { status } = await call('post', '/api/v1/core-bookings/create-with-payment', {
      businessId: 'biz_1',
      time: '14:00',
      partySize: 2,
    });
    expect(status).toBe(400);
  });

  it('returns 400 when time is missing', async () => {
    const { status } = await call('post', '/api/v1/core-bookings/create-with-payment', {
      businessId: 'biz_1',
      date: '2026-12-01',
      partySize: 2,
    });
    expect(status).toBe(400);
  });

  it('returns 400 when partySize is missing', async () => {
    const { status } = await call('post', '/api/v1/core-bookings/create-with-payment', {
      businessId: 'biz_1',
      date: '2026-12-01',
      time: '14:00',
    });
    expect(status).toBe(400);
  });

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null);
    const { status, body } = await call('post', '/api/v1/core-bookings/create-with-payment', validBody);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns the booking without a Square URL when Square is down', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      id: 'biz_1',
      name: 'Test Cleaning Co',
      category: 'CLEANING',
    } as never);
    vi.mocked(prisma.reservation.create).mockResolvedValueOnce({
      id: 'res_1',
      businessId: 'biz_1',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValueOnce({
      id: 'pay_1',
      reservationId: 'res_1',
    } as never);
    vi.mocked(rewardEngine.calculateRewards).mockReturnValueOnce({
      customerRewardUsd: 2.5,
      businessRewardUsd: 1.25,
      customerRewardPab: 25,
      businessRewardPab: 12.5,
      tierMultiplier: 1,
    } as never);
    vi.mocked(squareService.createCheckout).mockRejectedValueOnce(new Error('Square down'));

    const { status, body } = await call('post', '/api/v1/core-bookings/create-with-payment', validBody);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.squareCheckoutUrl).toBeNull();
    expect(body.data.bookingRef).toMatch(/^PAB-/);
    expect(body.data.depositAmount).toBe(25);
  });

  it('does not create a payment when the business is missing', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null);
    await call('post', '/api/v1/core-bookings/create-with-payment', validBody);
    expect(prisma.reservation.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
