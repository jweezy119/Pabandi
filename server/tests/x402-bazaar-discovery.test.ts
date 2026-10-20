import { describe, it, expect } from 'vitest';
import { X402_PAY_BAZAAR } from '../src/routes/x402.routes';
import { x402PaySchema } from '../src/schemas/agentic.schemas';
import { TOOLS } from '../src/mcp/pabandiMcpServer';

/**
 * The Bazaar discovery declaration is a promise an agent acts on without ever
 * opening this repo: hand it a 402 and it renders the request from
 * `extensions.bazaar`. If the declared schema drifted from what the route's
 * `validateBody` actually enforces, the agent would send a request the
 * endpoint rejects — discovery that lies is worse than none. So the declared
 * example is parsed against the REAL zod schema here, and the shape is pinned.
 */

type BazaarInfo = {
  info?: { input?: Record<string, unknown>; output?: Record<string, unknown> };
  schema?: { properties?: Record<string, unknown>; required?: string[] };
};

const declared = X402_PAY_BAZAAR.bazaar as BazaarInfo;

describe('x402 /pay Bazaar discovery', () => {
  it('declares the method and a JSON body the middleware-free route never fills in', () => {
    // The typed entry point omits `method` because the x402 middleware injects
    // it from route context; this route is hand-rolled, so the enrichment is
    // done by hand and must not be dropped by a refactor.
    expect((declared.info?.input as Record<string, unknown>)?.method).toBe('POST');
    expect((declared.info?.input as Record<string, unknown>)?.bodyType).toBe('json');
    const body = (declared.info?.input as Record<string, unknown>)?.body;
    expect(body).toMatchObject({ amount: 0.01 });
  });

  it('declares a schema whose required amount matches the enforced body schema', () => {
    // The extension's schema describes the request envelope; the actual body
    // schema is nested under properties.input.properties.body.
    const envelope = declared.schema?.properties?.input as
      | { properties?: { body?: { properties?: Record<string, unknown>; required?: string[] } } }
      | undefined;
    expect(envelope?.properties?.body?.properties?.amount).toMatchObject({ type: 'number' });
    expect(envelope?.properties?.body?.required).toContain('amount');
  });

  it('declared example validates against the enforced x402PaySchema — no drift', () => {
    const example = (declared.info?.input as Record<string, unknown>)?.body;
    const parsed = x402PaySchema.safeParse(example);
    expect(parsed.success).toBe(true);
  });

  it('declares an output example matching the settled-x402 response shape', () => {
    const out = (declared.info?.output as Record<string, unknown>)?.example as Record<string, unknown> | undefined;
    expect(out).toMatchObject({ success: true });
    expect((out?.data as Record<string, unknown>)?.settled).toBe(true);
    expect((out?.data as Record<string, unknown>)?.method).toBe('x402');
    expect((out?.data as Record<string, unknown>)).not.toHaveProperty('settled', false);
  });
});

describe('MCP paid-tool Bazaar discovery', () => {
  // Every tool in X402_PRICE_USDC must be able to produce an extension; the
  // registry lives in pabandiMcpServer, and the price keys are the contract.
  const PAID_TOOLS = ['pabandi_issue_passport', 'pabandi_start_escrow', 'pabandi_book_stay'];

  for (const toolName of PAID_TOOLS) {
    it(`${toolName} is published with a schema an agent can render`, () => {
      const tool = TOOLS.find((t) => (t as { name?: string }).name === toolName);
      expect(tool).toBeDefined();
      const schema = (tool as { inputSchema?: Record<string, unknown> } | undefined)?.inputSchema;
      expect(schema).toBeDefined();
      expect(schema?.type).toBe('object');
    });
  }
});
