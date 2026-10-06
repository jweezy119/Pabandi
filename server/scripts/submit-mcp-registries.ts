#!/usr/bin/env npx tsx
/**
 * submit-mcp-registries.ts — real registry distribution.
 *
 * Modes:
 *   npx tsx scripts/submit-mcp-registries.ts                 # print payloads + curl
 *   npx tsx scripts/submit-mcp-registries.ts --write out.json  # save payloads
 *   npx tsx scripts/submit-mcp-registries.ts --execute         # POST where an API exists
 *   npx tsx scripts/submit-mcp-registries.ts --check           # verify our live listing
 *
 * Only registries that expose a real HTTP API are executed. The rest are
 * human web forms; the script emits the exact payload for them rather than
 * pretending an automated POST worked.
 *
 * Env:
 *   MCP_REGISTRY_GITHUB_TOKEN  required to publish to the official registry
 */
import fs from 'fs';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import { AGENT_MCP_URL, SITE_URL } from '../src/mcp/agentEndpoint';

// The default here was https://pabandi.com/mcp. That host is the marketing SPA:
// its fallback answers any path with index.html, so the URL returns HTTP 200 and
// passes a naive liveness probe while returning text/html to the JSON-RPC POST
// that initialize actually sends. Submitting it would have published a listing
// that passes review and then fails on the developer's first call.
const MCP_URL = process.env.MCP_PUBLIC_URL || AGENT_MCP_URL;
const SITE = process.env.PUBLIC_SITE_URL || SITE_URL;
const VERSION = '1.0.0';

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const CHECK = args.has('--check');
const WRITE = [...args].find((a) => a.startsWith('--write='))?.split('=')[1]
  || (args.has('--write') ? 'mcp-registry-payloads.json' : undefined);

// ── payload built from the live server, so a listing can never drift ──────────
const description = [
  'Trust and settlement layer for AI agents: portable trust attestations (PTP),',
  'reputation risk bands, escrow, and x402/USDC payments on Solana.',
].join(' ');

const toolsForRegistry = (TOOLS as any[]).map((t) => ({
  name: t.name,
  description: String(t.description ?? '').slice(0, 400),
}));

const basePayload = {
  name: 'pabandi',
  displayName: 'Pabandi',
  description,
  version: VERSION,
  url: MCP_URL,
  transport: 'streamable-http',
  authentication: { type: 'bearer', instructions: 'API key from POST /api/v1/agents/register' },
  homepage: SITE,
  repository: { url: 'https://github.com/jweezy119/Pabandi', source: 'github' },
  docs: `${SITE}/llms.txt`,
  tools: toolsForRegistry,
};

type Registry = {
  name: string;
  humanUrl: string;
  submitUrl: string;
  api?: { method: string; url: string; tokenEnv?: string; body?: (p: any) => any };
  payload: any;
};

const REGISTRIES: Registry[] = [
  {
    name: 'Official MCP Registry',
    humanUrl: 'https://registry.modelcontextprotocol.io',
    submitUrl: 'https://registry.modelcontextprotocol.io/v0/servers',
    api: {
      method: 'POST',
      url: 'https://registry.modelcontextprotocol.io/v0/servers',
      tokenEnv: 'MCP_REGISTRY_GITHUB_TOKEN',
      body: (p) => ({ name: p.name, description: p.description, repository: p.repository, version_detail: { version: p.version }, packages: [{ registry_type: 'url', identifier: p.url, transport: { type: p.transport } }] }),
    },
    payload: basePayload,
  },
  {
    name: 'MCP.so',
    humanUrl: 'https://mcp.so',
    submitUrl: 'https://mcp.so/submit',
    payload: { name: 'Pabandi', description, mcpUrl: MCP_URL, category: 'trust', github: basePayload.repository.url },
  },
  {
    name: 'Glama.ai',
    humanUrl: 'https://glama.ai/mcp/servers',
    submitUrl: 'https://glama.ai/mcp/servers/submit',
    payload: { name: 'Pabandi', description, repository: basePayload.repository.url, command: null, url: MCP_URL },
  },
  {
    name: 'PulseMCP',
    humanUrl: 'https://www.pulsemcp.com',
    submitUrl: 'https://www.pulsemcp.com/servers/add',
    payload: { name: 'Pabandi', description, url: MCP_URL, github: basePayload.repository.url },
  },
  {
    name: 'MCPServers.org',
    humanUrl: 'https://mcpservers.org',
    submitUrl: 'https://mcpservers.org/submit',
    payload: { name: 'Pabandi', description, url: MCP_URL },
  },
  {
    name: 'Smithery.ai',
    humanUrl: 'https://smithery.ai',
    submitUrl: 'https://smithery.ai/register',
    payload: { name: 'Pabandi', description, url: MCP_URL, transport: 'streamable-http' },
  },
  {
    name: 'MCPMarket.com',
    humanUrl: 'https://mcpmarket.com',
    submitUrl: 'https://mcpmarket.com/submit',
    payload: { name: 'Pabandi', description, mcpUrl: MCP_URL },
  },
  {
    name: 'Anthropic MCP Directory',
    humanUrl: 'https://claude.com/connectors',
    submitUrl: 'https://claude.com/connectors',
    payload: { name: 'Pabandi', description, mcpUrl: MCP_URL },
  },
];

// ── check: is our listing actually live? ─────────────────────────────────────
async function check() {
  const res = await fetch('https://registry.modelcontextprotocol.io/v0/servers?search=pabandi', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`✗ official registry check failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const body: any = await res.json();
  const servers: any[] = body?.servers ?? body?.data ?? [];
  const hit = servers.find((s) => JSON.stringify(s).toLowerCase().includes('pabandi'));
  if (!hit) {
    console.error('✗ no Pabandi listing found in the official MCP registry');
    process.exit(1);
  }
  console.log(`✓ listed: ${JSON.stringify(hit, null, 2).slice(0, 400)}`);
}

// ── execute: POST only where an API exists ───────────────────────────────────
async function execute() {
  const results: Record<string, string> = {};
  for (const r of REGISTRIES) {
    if (!r.api) {
      results[r.name] = `manual — ${r.submitUrl}`;
      continue;
    }
    const token = r.api.tokenEnv ? process.env[r.api.tokenEnv] : undefined;
    if (r.api.tokenEnv && !token) {
      results[r.name] = `skipped — ${r.api.tokenEnv} not set`;
      continue;
    }
    try {
      const res = await fetch(r.api.url, {
        method: r.api.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(r.api.body ? r.api.body(r.payload) : r.payload),
      });
      const text = await res.text();
      results[r.name] = res.ok ? `published (HTTP ${res.status})` : `failed (HTTP ${res.status}) ${text.slice(0, 200)}`;
    } catch (e: any) {
      results[r.name] = `failed — ${e.message}`;
    }
  }
  for (const [name, status] of Object.entries(results)) console.log(`${name}: ${status}`);
  const hardFailures = Object.entries(results).filter(([, s]) => s.startsWith('failed'));
  if (hardFailures.length > 0) process.exit(1);
}

async function main() {
if (CHECK) {
  await check();
  return;
}
if (EXECUTE) {
  await execute();
  return;
}
{
  console.log('=== MCP Registry Submissions ===\n');
  console.log(`MCP endpoint: ${MCP_URL}`);
  console.log(`Tools in payload: ${toolsForRegistry.length}\n`);
  for (const r of REGISTRIES) {
    console.log(`--- ${r.name} ---`);
    console.log(r.api ? `API     : ${r.api.method} ${r.api.url}` : `WEB FORM: ${r.submitUrl}`);
    console.log(JSON.stringify(r.payload, null, 2));
    console.log(
      r.api
        ? `curl -X ${r.api.method} ${r.api.url} \\\n  -H "Content-Type: application/json" \\\n  ${r.api.tokenEnv ? `-H "Authorization: Bearer $${r.api.tokenEnv}" \\\n  ` : ''}-d '${JSON.stringify(r.api.body ? r.api.body(r.payload) : r.payload)}'`
        : `  → paste this payload at ${r.submitUrl}`
    );
    console.log();
  }
  if (WRITE) {
    fs.writeFileSync(WRITE, JSON.stringify(Object.fromEntries(REGISTRIES.map((r) => [r.name, r.payload])), null, 2));
    console.log(`payloads written to ${WRITE}`);
  }
  console.log('=== Run with --execute to publish where an API exists ===');
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
