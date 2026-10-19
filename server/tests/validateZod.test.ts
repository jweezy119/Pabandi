import { describe, it, expect } from 'vitest';
import { validateWithZod, formatZodError } from '../src/middleware/validateZod';
import { agentRegistrationSchema } from '../src/schemas/agentic.schemas';
import { z } from 'zod';

/**
 * The point of this file is the request that never comes from a test author.
 * Every case below is something an agent guessed at or replayed from a
 * mutated log, and the assertion is that the request dies at the edge with a
 * 400 naming the offending field -- not that it reaches a handler, and not that
 * it throws a 500.
 *
 * These run the middleware directly rather than over HTTP. The transport is
 * Express's; what is under test is what the middleware does with a parsed
 * body, and driving that through a listening server would only add flakiness.
 */

interface CapturedResponse {
  statusCode: number;
  body: unknown;
  nextCalled: boolean;
}

function runMiddleware(
  schema: z.ZodTypeAny,
  body: unknown
): CapturedResponse {
  const captured: CapturedResponse = { statusCode: 200, body: undefined, nextCalled: false };

  const req = { body } as never;
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as never;

  validateWithZod(schema)(req, res, () => {
    captured.nextCalled = true;
  });

  return captured;
}

describe('validateWithZod', () => {
  it('rejects a missing body with 400 rather than 500', () => {
    const result = runMiddleware(agentRegistrationSchema, undefined);

    expect(result.statusCode).toBe(400);
    expect(result.nextCalled).toBe(false);
  });

  it('rejects an empty object and names every missing field', () => {
    const result = runMiddleware(agentRegistrationSchema, {});

    expect(result.statusCode).toBe(400);
    expect(result.nextCalled).toBe(false);

    const body = result.body as { errors: Record<string, string>; details: unknown[] };
    // All three required fields are reported, not just the first. An agent
    // fixing a rejected call should not need three round trips to find out
    // what was wrong.
    expect(Object.keys(body.errors).sort()).toEqual(['agentHandle', 'name', 'ownerEmail']);
    expect(body.details.length).toBeGreaterThanOrEqual(3);
  });

  it('reports the exact field path for a nested failure', () => {
    const result = runMiddleware(agentRegistrationSchema, {
      // Valid handle on purpose: this case is about attributing the failure to
      // ownerEmail alone, so a second invalid field would defeat the point.
      agentHandle: 'valid-handle',
      ownerEmail: 'not-an-email',
      name: 'A',
    });

    const body = result.body as { errors: Record<string, string> };
    expect(result.statusCode).toBe(400);
    expect(body.errors.ownerEmail).toBeDefined();
    expect(body.errors.agentHandle).toBeUndefined();
  });

  it('rejects a non-string where a string is required, instead of coercing', () => {
    const result = runMiddleware(agentRegistrationSchema, {
      agentHandle: 12345,
      ownerEmail: 'a@b.com',
      name: 'A',
    });

    expect(result.statusCode).toBe(400);
    const body = result.body as { errors: Record<string, string> };
    expect(body.errors.agentHandle).toContain('agentHandle');
  });

  it('passes a valid payload through and normalises it', () => {
    const result = runMiddleware(agentRegistrationSchema, {
      agentHandle: 'my-agent',
      ownerEmail: 'owner@example.com',
      name: 'My Agent',
      capabilities: ['booking'],
      // An agent that echoes back a field it saw in a response must not be
      // able to smuggle it into the handler.
      isAdmin: true,
    });

    expect(result.statusCode).toBe(200);
    expect(result.nextCalled).toBe(true);
  });

  it('strips unknown keys from the parsed body', () => {
    const req = { body: { agentHandle: 'a-b-c', ownerEmail: 'a@b.com', name: 'N', isAdmin: true } } as never;
    let seen: unknown;

    validateWithZod(agentRegistrationSchema)(req, {} as never, () => {
      seen = (req as unknown as { body: Record<string, unknown> }).body;
    });

    expect(seen).not.toHaveProperty('isAdmin');
    expect(seen).toMatchObject({ agentHandle: 'a-b-c' });
  });

  it('applies schema defaults, so a handler can rely on capabilities existing', () => {
    const req = { body: { agentHandle: 'a-b-c', ownerEmail: 'a@b.com', name: 'N' } } as never;
    let seen: { capabilities: string[] } | undefined;

    validateWithZod(agentRegistrationSchema)(req, {} as never, () => {
      seen = (req as unknown as { body: { capabilities: string[] } }).body;
    });

    expect(seen?.capabilities).toEqual([]);
  });

  it('survives a prototype-pollution attempt in the body', () => {
    const result = runMiddleware(agentRegistrationSchema, JSON.parse('{"__proto__": {"isAdmin": true}, "agentHandle": "a-b-c", "ownerEmail": "a@b.com", "name": "N"}'));

    expect(result.statusCode).toBe(200);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });
});

describe('formatZodError', () => {
  it('keeps only the first message per field', () => {
    const result = z.object({ a: z.string().min(5, 'too short').regex(/x/, 'must contain x') }).safeParse({ a: '' });

    expect(result.success).toBe(false);
    if (result.success) return;

    const body = formatZodError(result.error);
    expect(body.errors.a).toBe('too short');
    // Both issues are still available in `details` for an agent that wants them.
    expect(body.details.filter((d) => d.field === 'a')).toHaveLength(2);
  });

  it('labels a root-level failure as general', () => {
    const result = z.string().safeParse(42);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatZodError(result.error).errors.general).toBeDefined();
  });
});