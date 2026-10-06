import { describe, it, expect } from 'vitest';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import { toolAccessOk, findRegistryTool, pabandiToolsRegistry } from '../src/services/pabandiTools.service';

/**
 * Every tool in tools/list must be resolvable by the access gate.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `callPlatformHttp` gates every call with:
 *
 *     toolAccessOk(def.name, ...)
 *
 * passing the **MCP tool name** — `pabandi_platform_discovery`. But `toolAccessOk`
 * resolves a tool by matching that string against the registry's `short` label or
 * its `pabandi:internal` name, neither of which is the published MCP name:
 *
 *     pabandi:discover   short: "Pabandi platform discovery"
 *     mcpName:           pabandi_platform_discovery
 *
 * Those two namespaces only coincide by accident, and for these entries they never
 * do. So the gate answered `unknown tool: <name>` for the tool it was literally
 * given, and 19 of 20 tools failed their own access check.
 *
 * The visible symptom was narrow and misleading: `tools/list` returned all 20, so
 * the surface looked healthy, and only `pabandi_discover_platform` worked when
 * called — because it is served by an inline handler and never reaches the proxy
 * path where the gate runs. Everything else returned
 * `access denied: unknown tool: <the tool you just asked for>`, which reads like
 * an authorization failure and is in fact a name-resolution failure.
 *
 * A public tool that a stranger cannot call is not a discoverability problem, it
 * is a broken promise in the listing. This asserts the two namespaces agree for
 * every tool, so the gate cannot reject a name the server itself published.
 */
/**
 * Only the platform tools go through this gate. The four engine tools —
 * pabandi_verify_passport, pabandi_discover, pabandi_get_ledger,
 * pabandi_issue_passport — plus the two inline tools pabandi_discover_platform and
 * pabandi_platform_access have their own handlers and their own access logic, and
 * are deliberately not in pabandiToolsRegistry. They are excluded below rather
 * than asserted through the gate they never call.
 */
const platformTools = (TOOLS as Array<{ name: string; access?: string }>).filter((t) =>
  findRegistryTool(t.name) !== undefined,
);

describe('MCP tool names resolve through the access gate', () => {
  it('covers every platform tool, not a hand-picked subset', () => {
    // If this shrinks, the gate has stopped being consulted for some tool and the
    // test below would pass while ignoring it.
    expect(platformTools.length).toBeGreaterThanOrEqual(14);
  });

  it('resolves every platform tool by its published MCP name', async () => {
    const unresolved: string[] = [];

    for (const tool of platformTools) {
      const result = await toolAccessOk(tool.name, undefined, {
        ownerUserId: undefined,
        businessId: undefined,
        verifiedRail: false,
      });
      // Deliberately unauthenticated. A `public` tool must resolve for anyone, so
      // anything reported as "unknown tool" here is a name-resolution bug rather
      // than a permission decision.
      if (!result.ok && String(result.reason).startsWith('unknown tool')) {
        unresolved.push(tool.name);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('reports a permission decision rather than a name failure for gated tools', async () => {
    // The distinction matters to anyone debugging this: "requires owner access" is
    // correct behaviour, "unknown tool" is a bug that reads like one.
    for (const tool of platformTools) {
      if (tool.access === 'public') continue;
      const result = await toolAccessOk(tool.name, undefined, {
        ownerUserId: undefined,
        businessId: undefined,
        verifiedRail: false,
      });
      expect(String(result.reason)).not.toMatch(/^unknown tool/);
    }
  });

  it('resolves the internal registry name and the MCP name to the same entry', async () => {
    // Both namespaces have to work, because callers use both: the gate is reached
    // with the MCP name, while tooling and docs refer to `pabandi:discover`.
    for (const entry of pabandiToolsRegistry) {
      if (!entry.mcpName) continue;
      const viaInternal = findRegistryTool(entry.name);
      const viaMcp = findRegistryTool(entry.mcpName);
      expect(viaInternal?.name).toBe(entry.name);
      expect(viaMcp?.name).toBe(entry.name);
    }
  });

  it('gives every public registry tool a resolvable MCP name', () => {
    // The gate looks tools up by mcpName, so an entry without one cannot be
    // reached at all — and it still appears in tools/list, because the tool
    // builder derives a fallback name from the marketing label instead.
    const missing = pabandiToolsRegistry
      .filter((t) => t.category !== 'sdk')
      .filter((t) => !t.mcpName)
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('keeps published tool names and registry mcpNames in one-to-one agreement', async () => {
    // Catches the reverse failure: two tools resolving to the same registry entry,
    // which would let a caller on the weaker tier reach the stronger tier's
    // endpoint.
    const resolved = new Map<string, string>();
    const collisions: string[] = [];

    for (const tool of TOOLS as Array<{ name: string }>) {
      const entry = findRegistryTool(tool.name);
      if (!entry) continue;
      const owner = resolved.get(entry.name);
      if (owner && owner !== tool.name) {
        collisions.push(`${entry.name} reached by both ${owner} and ${tool.name}`);
      }
      resolved.set(entry.name, tool.name);
    }
    expect(collisions).toEqual([]);
  });
});