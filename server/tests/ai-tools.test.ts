import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOLS, callTool } from '../src/mcp/pabandiMcpServer';
import { TOOL_SCOPES } from '../src/services/agentScopes.service';

const src = (rel: string) => readFileSync(resolve(__dirname, '../src', rel), 'utf8');

describe('AI-backed MCP tools', () => {
  it('exposes the already-implemented AI capabilities as scoped tools', () => {
    for (const name of [
      'pabandi_ai_status',
      'pabandi_ai_classify',
      'pabandi_ai_concierge',
      'pabandi_get_booking_risk',
    ]) {
      expect(TOOLS.some((t) => t.name === name), `${name} should be listed`).toBe(true);
      expect(TOOL_SCOPES[name], `${name} must have a scope`).toBeDefined();
    }
  });

  it('requires an agent key for the SMS-sending auto-repair tool', async () => {
    // A plain JWT is authenticated but must not be enough for an SMS-sending tool.
    const res: any = await callTool('pabandi_book_auto_repair', {}, {
      id: 'u1',
      email: 'user@example.com',
      role: 'USER',
    } as any);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/agent API key is required/);
  });

  it('enforces scopes on the new risk tool', async () => {
    const res: any = await callTool(
      'pabandi_get_booking_risk',
      { bookingId: 'b1' },
      { id: 'u1', agentKeyId: 'k1', scopes: ['directory'] } as any,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/missing scope/);
  });
});

describe('AI router reliability', () => {
  const router = src('services/ai/aiProvider.router.ts');

  it('uses cheap-first ordering for high-volume tasks', () => {
    expect(router).toMatch(/CHEAP_FIRST/);
    expect(router).toMatch(/options\.task/);
  });

  it('bounds the whole fallback chain with a deadline and cooldown', () => {
    expect(router).toMatch(/routerDeadline\(\)/);
    expect(router).toMatch(/cooldownUntil/);
    expect(router).toMatch(/withTimeout\(/);
  });

  it('passes task hints from the NLP service', () => {
    const nlp = src('services/ai.nlp.service.ts');
    expect(nlp).toMatch(/task: 'classification'/);
    expect(nlp).toMatch(/task: 'copy'/);
  });
});
