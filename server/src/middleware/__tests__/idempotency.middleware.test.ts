import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import {
  requireIdempotency,
  clearMemoryStore,
  computePayloadHash,
} from '../idempotency.middleware';

// Helper to simulate an Express request pipeline without requiring network ports
function createMockPipeline(controllerFn: (req: Request, res: Response) => void) {
  return async (reqPartial: Partial<Request>) => {
    let statusCode = 200;
    let headers: Record<string, string> = {};
    let responseBody: any = null;
    let finished = false;

    const req: any = {
      method: 'POST',
      url: '/api/v1/payments/create',
      path: '/api/v1/payments/create',
      originalUrl: '/api/v1/payments/create',
      headers: {},
      header: (name: string) => req.headers[name.toLowerCase()],
      body: {},
      ...reqPartial,
    };

    // Ensure header lookup is lowercase-friendly
    req.headers = Object.fromEntries(
      Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      setHeader(k: string, v: string) {
        headers[k] = v;
        return this;
      },
      getHeader(k: string) {
        return headers[k];
      },
      json(data: any) {
        responseBody = data;
        finished = true;
        return this;
      },
      send(data: any) {
        responseBody = data;
        finished = true;
        return this;
      },
      get statusCode() {
        return statusCode;
      },
    };

    let nextCalled = false;
    let nextError: any = null;

    const next = (err?: any) => {
      nextCalled = true;
      if (err) nextError = err;
      else controllerFn(req, res);
    };

    await requireIdempotency(req, res, next);

    return {
      statusCode,
      headers,
      body: responseBody,
      nextCalled,
      nextError,
    };
  };
}

describe('Global Idempotency Middleware', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  const VALID_UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const VALID_UUID_2 = 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22';

  it('Test 4: Missing Idempotency-Key header returns 400 Bad Request', async () => {
    const controllerSpy = vi.fn((req, res) => res.json({ success: true }));
    const runPipeline = createMockPipeline(controllerSpy);

    const response = await runPipeline({
      headers: {},
      body: { amount: 50 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Idempotency-Key header is required for this operation',
    });
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('Rejects malformed (non-UUID v4) Idempotency-Key with 400', async () => {
    const controllerSpy = vi.fn((req, res) => res.json({ success: true }));
    const runPipeline = createMockPipeline(controllerSpy);

    const response = await runPipeline({
      headers: { 'idempotency-key': 'not-a-uuid' },
      body: { amount: 50 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Idempotency-Key must be a valid UUID v4',
    });
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('Test 1: Sending two identical requests with the same Idempotency-Key returns the cached response and controller is only called ONCE', async () => {
    let callCount = 0;
    const controllerSpy = vi.fn((req, res) => {
      callCount++;
      res.status(201).json({
        id: 'ord_12345',
        amount: req.body.amount,
        status: 'created',
      });
    });

    const runPipeline = createMockPipeline(controllerSpy);

    // First request
    const res1 = await runPipeline({
      headers: { 'idempotency-key': VALID_UUID_1 },
      body: { amount: 100, currency: 'USD' },
    });

    expect(res1.statusCode).toBe(201);
    expect(res1.body).toEqual({ id: 'ord_12345', amount: 100, status: 'created' });
    expect(controllerSpy).toHaveBeenCalledTimes(1);

    // Second request (identical payload and key)
    const res2 = await runPipeline({
      headers: { 'idempotency-key': VALID_UUID_1 },
      body: { amount: 100, currency: 'USD' },
    });

    expect(res2.statusCode).toBe(201);
    expect(res2.body).toEqual({ id: 'ord_12345', amount: 100, status: 'created' });
    expect(res2.headers['X-Cache-Lookup']).toBe('IDEMPOTENT_HIT');
    // Controller must NOT be executed a second time
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 2: Sending two requests with the same key but different payloads returns 422 Unprocessable Entity', async () => {
    const controllerSpy = vi.fn((req, res) => res.json({ success: true }));
    const runPipeline = createMockPipeline(controllerSpy);

    // Request 1 with payload A
    const res1 = await runPipeline({
      headers: { 'idempotency-key': VALID_UUID_1 },
      body: { amount: 100, note: 'order A' },
    });
    expect(res1.statusCode).toBe(200);
    expect(controllerSpy).toHaveBeenCalledTimes(1);

    // Request 2 with payload B under same key
    const res2 = await runPipeline({
      headers: { 'idempotency-key': VALID_UUID_1 },
      body: { amount: 500, note: 'order B - tampered amount' },
    });

    expect(res2.statusCode).toBe(422);
    expect(res2.body).toEqual({
      error: 'Idempotency key reused with different payload',
    });
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 3: Concurrent in-flight requests with the same key return 409 Conflict', async () => {
    // Controller simulating slow async processing (doesn't finish immediately)
    let finishController: () => void;
    const controllerSpy = vi.fn((req, res) => {
      // Intentionally pending until released
    });

    const runPipeline = createMockPipeline(controllerSpy);

    // Request 1 enters 'processing' state
    const promise1 = runPipeline({
      headers: { 'idempotency-key': VALID_UUID_2 },
      body: { amount: 250 },
    });

    // Request 2 arrives immediately while Request 1 is still in 'processing' state
    const res2 = await runPipeline({
      headers: { 'idempotency-key': VALID_UUID_2 },
      body: { amount: 250 },
    });

    expect(res2.statusCode).toBe(409);
    expect(res2.body).toEqual({
      error: 'Request already in progress',
    });
  });

  it('Allows non-mutating GET requests to pass through without Idempotency-Key', async () => {
    const controllerSpy = vi.fn((req, res) => res.json({ message: 'public get' }));
    const runPipeline = createMockPipeline(controllerSpy);

    const res = await runPipeline({
      method: 'GET',
      headers: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'public get' });
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });
});

