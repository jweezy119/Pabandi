import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';

const mockBusinessFindFirst = vi.fn();
const mockMethodFindMany = vi.fn();
const mockMethodFindFirst = vi.fn();
const mockMethodCount = vi.fn();
const mockMethodCreate = vi.fn();
const mockMethodUpdate = vi.fn();
const mockMethodUpdateMany = vi.fn();
const mockMethodDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../src/middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'user-owner' };
    next();
  },
}));

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findFirst: mockBusinessFindFirst },
    businessPaymentMethod: {
      findMany: mockMethodFindMany,
      findFirst: mockMethodFindFirst,
      count: mockMethodCount,
      create: mockMethodCreate,
      update: mockMethodUpdate,
      updateMany: mockMethodUpdateMany,
      delete: mockMethodDelete,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('/api/v1/payment-methods routes', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const mod = await import('../src/routes/paymentMethods.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/payment-methods', mod.default);
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1/payment-methods`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists payment methods for an owned business', async () => {
    mockBusinessFindFirst.mockResolvedValue({ id: 'biz-1' });
    mockMethodFindMany.mockResolvedValue([
      { id: 'pm-1', businessId: 'biz-1', railId: 'solana', target: '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG', isDefault: true },
    ]);

    const res = await fetch(`${baseUrl}?businessId=biz-1`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(mockBusinessFindFirst).toHaveBeenCalledWith({
      where: { id: 'biz-1', ownerId: 'user-owner' },
      select: { id: true },
    });
  });

  it('rejects GET for a business owned by another user (403)', async () => {
    mockBusinessFindFirst.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}?businessId=biz-other`);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(mockMethodFindMany).not.toHaveBeenCalled();
  });

  it('creates a valid Solana payout method and marks first method as default', async () => {
    mockBusinessFindFirst.mockResolvedValue({ id: 'biz-1' });
    mockMethodFindFirst.mockResolvedValue(null);
    mockMethodCount.mockResolvedValue(0);
    mockMethodCreate.mockResolvedValue({
      id: 'pm-sol',
      businessId: 'biz-1',
      railId: 'solana',
      displayName: 'Solana USDC',
      target: '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG',
      isDefault: true,
    });

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: 'biz-1',
        railId: 'solana',
        target: '  5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG  ',
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockMethodCreate).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        railId: 'solana',
        displayName: 'Solana USDC',
        target: '5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG',
        isDefault: true,
      },
    });
  });

  it('updates an existing Solana payout address in place instead of duplicating', async () => {
    mockBusinessFindFirst.mockResolvedValue({ id: 'biz-1' });
    mockMethodFindFirst.mockResolvedValue({ id: 'pm-existing', railId: 'solana' });
    mockMethodUpdate.mockResolvedValue({
      id: 'pm-existing',
      businessId: 'biz-1',
      railId: 'solana',
      displayName: 'Solana USDC',
      target: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      isDefault: true,
    });

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: 'biz-1',
        railId: 'solana',
        target: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockMethodCreate).not.toHaveBeenCalled();
    expect(mockMethodUpdate).toHaveBeenCalledWith({
      where: { id: 'pm-existing' },
      data: {
        target: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        displayName: 'Solana USDC',
      },
    });
  });

  it('rejects invalid Solana address with 400', async () => {
    mockBusinessFindFirst.mockResolvedValue({ id: 'biz-1' });

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: 'biz-1',
        railId: 'solana',
        target: 'not-a-valid-address',
      }),
    });

    expect(res.status).toBe(400);
    expect(mockMethodCreate).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant DELETE with 404', async () => {
    mockMethodFindFirst.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/pm-foreign`, { method: 'DELETE' });

    expect(res.status).toBe(404);
    expect(mockMethodDelete).not.toHaveBeenCalled();
  });

  it('atomically switches default payment method for an owned business', async () => {
    mockBusinessFindFirst.mockResolvedValue({ id: 'biz-1' });
    mockMethodFindFirst.mockResolvedValue({ id: 'pm-2' });
    mockTransaction.mockResolvedValue([
      { count: 1 },
      { id: 'pm-2', businessId: 'biz-1', isDefault: true },
    ]);

    const res = await fetch(`${baseUrl}/pm-2/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: 'biz-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('pm-2');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
