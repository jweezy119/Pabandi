import { describe, it, expect } from 'vitest';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import { toThousandScale } from '../src/services/trust.service';
import { x402PaySchema } from '../src/schemas/agentic.schemas';

/**
 * The requirement Phase 4 states for MCP: execute_transaction must require a
 * sessionId, and must tell an agent which call to make next when there isn't
 * one. A refusal the agent cannot act on is a dead end, so the error text is
 * asserted as carefully as the behaviour.
 */

describe('MCP tool surface', () => {
  const toolNames = TOOLS.map((t) => (t as { name: string }).name);

  it('publishes pabandi_execute_transaction', () => {
    expect(toolNames).toContain('pabandi_execute_transaction');
  });

  it('publishes pabandi_open_session, so the requirement is satisfiable', () => {
    // Without this the requirement would be unmeetable over MCP: the tool
    // would demand a sessionId and offer no MCP way to get one.
    expect(toolNames).toContain('pabandi_open_session');
  });

  it('requires sessionId on execute_transaction', () => {
    const tool = TOOLS.find((t) => (t as { name: string }).name === 'pabandi_execute_transaction') as {
      inputSchema: { required?: string[] };
    };

    expect(tool.inputSchema.required).toContain('sessionId');
  });

  it('requires actionType and amount too', () => {
    const tool = TOOLS.find((t) => (t as { name: string }).name === 'pabandi_execute_transaction') as {
      inputSchema: { required?: string[] };
    };

    expect(tool.inputSchema.required).toEqual(
      expect.arrayContaining(['sessionId', 'actionType', 'amount'])
    );
  });

  it('documents the no-signature behaviour in its own description', () => {
    const tool = TOOLS.find((t) => (t as { name: string }).name === 'pabandi_execute_transaction') as {
      description: string;
    };

    expect(tool.description).toMatch(/session/i);
    expect(tool.description).toMatch(/pabandi_open_session/);
  });

  it('introduces no duplicate tool names', () => {
    // A duplicate makes an agent pick at random; the server suppresses the
    // shadowed one and logs, so this asserts nothing new shadowed the tool.
    expect(new Set(toolNames).size).toBe(toolNames.length);
  });
});

describe('toThousandScale', () => {
  // schema.prisma:64-66 records this exact bug having already happened once:
  // User.reliabilityScore "was @default(750) -- a 0-1000-scale value in a 0-100
  // field, which made every new account read as GOLD".
  it('maps the 0-100 scale onto 0-1000', () => {
    expect(toThousandScale(100)).toBe(1000);
    expect(toThousandScale(50)).toBe(500);
    expect(toThousandScale(0)).toBe(0);
    expect(toThousandScale(85)).toBe(850);
  });

  it('moves a perfect 0-100 score above the 800 session tier threshold', () => {
    // The regression this guards: at face value 100 would fall below 500 and a
    // flawless principal would get the $20/24h tab instead of $1000/30d.
    expect(toThousandScale(100)).toBeGreaterThanOrEqual(800);
  });

  it('keeps a cold-start 50 at the neutral 500', () => {
    expect(toThousandScale(50)).toBe(500);
  });

  it('rounds to an integer', () => {
    expect(Number.isInteger(toThousandScale(33.333))).toBe(true);
  });
});

describe('x402PaySchema', () => {
  it('accepts a session-based micropayment', () => {
    const result = x402PaySchema.safeParse({ amount: 0.01, sessionId: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('rejects a negative amount', () => {
    expect(x402PaySchema.safeParse({ amount: -5 }).success).toBe(false);
  });

  it('rejects an amount that is not a number', () => {
    // A JSON body can carry a string; without a type check "5" would arrive and
    // arithmetic on it would concatenate.
    expect(x402PaySchema.safeParse({ amount: '5' }).success).toBe(false);
  });

  it('rejects Infinity, which JSON cannot carry but a JS caller can', () => {
    expect(x402PaySchema.safeParse({ amount: Number.POSITIVE_INFINITY }).success).toBe(false);
  });

  it('rejects NaN', () => {
    expect(x402PaySchema.safeParse({ amount: Number.NaN }).success).toBe(false);
  });

  it('rejects an absurd amount', () => {
    expect(x402PaySchema.safeParse({ amount: 1e12 }).success).toBe(false);
  });

  it('allows amount 0 for a free metered call', () => {
    const result = x402PaySchema.safeParse({ amount: 0 });
    expect(result.success).toBe(true);
  });
});
describe('x402 price schedule compatibility', () => {
  it('accepts every absolute price in X402_PRICING', async () => {
    // The Phase 1 version of this schema capped amounts at 2 decimal places
    // with a refine that rejected every non-integer amount outright -- so it
    // rejected 0.01, TRUST_API_CALL, and the whole price schedule with it.
    const { X402_PRICING } = await import('../src/config/fees');

    for (const [name, price] of Object.entries(X402_PRICING)) {
      const result = x402PaySchema.safeParse({ amount: price });
      expect(result.success, `${name} = ${price} was rejected`).toBe(true);
    }
  });
});
