import { describe, it, expect } from 'vitest';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import { pabandiToolsRegistry } from '../src/services/pabandiTools.service';

describe('agent-facing MCP surface', () => {
  it('exposes no duplicate tool names', () => {
    const names = (TOOLS as any[]).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses clean, stable snake_case identifiers', () => {
    for (const t of TOOLS as any[]) {
      expect(t.name).toMatch(/^pabandi_[a-z0-9_]+$/);
    }
  });

  it('never derives a published tool name from marketing copy', () => {
    // Renaming a `short` label must not change any published tool name.
    const missing = pabandiToolsRegistry.filter((t: any) => !t.mcpName);
    expect(missing.map((t: any) => t.name)).toEqual([]);
  });

  it('declares exactly one MCP name per registry entry', () => {
    const names = pabandiToolsRegistry.map((t: any) => t.mcpName).filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every tool a description an agent can act on', () => {
    for (const t of TOOLS as any[]) {
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema).toBeTruthy();
    }
  });
});
