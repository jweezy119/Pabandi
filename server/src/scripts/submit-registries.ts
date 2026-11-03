/**
 * server/src/scripts/submit-registries.ts
 *
 * Pabandi Agent Discovery & Monetization Layer — Registry Submission Script.
 *
 * Discovers all paid (x402-gated) MCP endpoints exposed by the Pabandi MCP
 * server and emits the exact metadata required to register them on external
 * MCP registries:
 *
 *   - MCP.so          https://mcp.so
 *   - Glama.ai        https://glama.ai
 *   - Smithery        https://smithery.ai
 *   - Agentic.Market  https://agentic.market
 *
 * Usage:
 *   npx tsx server/src/scripts/submit-registries.ts
 *
 * Outputs JSON suitable for copy-pasting into each registry's submission form.
 */

import { fetch } from 'undici';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

// ─────────────────────────────────────────────────────────────────────────────
// MCP server base — same host the MCP server listens on
// ─────────────────────────────────────────────────────────────────────────────
const MCP_BASE = process.env.MCP_BASE_URL || 'http://localhost:5000/mcp';

// CDP x402 Bazaar MCP discovery endpoint (used to discover paid endpoints)
const CDP_BAZAAR_MCP = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp';

// ─────────────────────────────────────────────────────────────────────────────
// Registry metadata templates
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  name: string;
  description: string;
  category: string;
  tags: string[];
  priceUsdc: number;
  endpoint: string;          // MCP server URL for this tool
  method: string;            // 'tools/call'
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  auth: 'api-key' | 'bearer' | 'none';
  contactEmail: string;
  website: string;
  documentationUrl: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
}

const MCP_SERVER_URL = process.env.MCP_BASE_URL || 'https://api.pabandi.com/mcp';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://pabandi.com';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'dev@pabandi.com';

const REGISTRIES = [
  {
    name: 'MCP.so',
    url: 'https://mcp.so/submit',
    description: 'MCP.so — open registry for Model Context Protocol servers',
  },
  {
    name: 'Glama.ai',
    url: 'https://glama.ai/mcp/submit',
    description: 'Glama.ai — AI agent marketplace and MCP server directory',
  },
  {
    name: 'Smithery',
    url: 'https://smithery.ai/server/new',
    description: 'Smithery — MCP server registry and deployment platform',
  },
  {
    name: 'Agentic.Market',
    url: 'https://agentic.market/submit',
    description: 'Agentic.Market — marketplace for AI agent tools and services',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (mirrors the MCP server tools)
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  priceUsdc: number;
  endpointPath: string;
  method: 'GET' | 'POST';
}> = [
  {
    name: 'pabandi_verify_human',
    description: 'Verify a human trust passport and get their trust score, tier, and verification status. Use this before booking or transacting with any human counterparty to assess reliability.',
    inputSchema: {
      type: 'object',
      properties: {
        passportId: { type: 'string', description: 'Trust Passport ID to verify' },
      },
      required: ['passportId'],
    },
    priceUsdc: 0.01,
    endpointPath: '/api/v1/agent/verify-human/:passportId',
    method: 'GET',
  },
  {
    name: 'pabandi_create_escrow',
    description: 'Create an escrow for an agent-to-agent deal. Locks funds in escrow until the deliverable is verified. Returns escrowId, status, and amount locked.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in USDC to lock in escrow' },
        description: { type: 'string', description: 'Human-readable description of what the escrow secures' },
        payerId: { type: 'string', description: 'Payer user/agent ID' },
        payeeId: { type: 'string', description: 'Payee user/agent ID' },
      },
      required: ['amount', 'description', 'payerId', 'payeeId'],
    },
    priceUsdc: 0, // dynamic: 0.5% of amount
    endpointPath: '/api/v1/agent/create-escrow',
    method: 'POST',
  },
  {
    name: 'pabandi_search_services',
    description: 'Search verified businesses by city and category. Returns business name, trust score, category, and city. Use this to find trustworthy service providers before booking.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City to search in (optional)' },
        category: { type: 'string', description: 'Service category to filter by (optional)' },
      },
      required: [],
    },
    priceUsdc: 0.05,
    endpointPath: '/api/v1/agent/search-services',
    method: 'GET',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Fetch tools from the MCP server's tools/list endpoint
// ─────────────────────────────────────────────────────────────────────────────

async function fetchMcpTools(): Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>> {
  try {
    const res = await fetch(`${MCP_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });
    if (!res.ok) {
      logger.warn(`[submit-registries] MCP tools/list returned ${res.status}, falling back to static definitions`);
      return TOOLS;
    }
    const data = (await res.json()) as { result?: { tools?: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }> } };
  const tools = (data.result?.tools || []) as Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema || {},
  }));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`[submit-registries] Failed to fetch MCP tools: ${errMsg}, using static definitions`);
    return TOOLS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build registry entries from discovered tools
// ─────────────────────────────────────────────────────────────────────────────

function buildRegistryEntries(tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>): RegistryEntry[] {
  // Build a price lookup from the static TOOLS definition (which has prices)
  const priceLookup: Record<string, number> = {};
  for (const t of TOOLS) {
    priceLookup[t.name] = t.priceUsdc;
  }

  return tools.map((tool) => {
    const priceUsdc = (priceLookup[tool.name] ?? 0) as number;
    return {
      name: tool.name,
      description: tool.description,
      category: 'Agent Economy',
      tags: ['pabandi', 'escrow', 'trust', 'yield', 'x402', 'agent-economy', 'solana'],
      priceUsdc,
      endpoint: MCP_SERVER_URL,
      method: 'tools/call',
      inputSchema: tool.inputSchema,
      id: tool.name,
      outputSchema: undefined,
      auth: 'api-key' as const,
      contactEmail: CONTACT_EMAIL,
      website: PLATFORM_URL,
      documentationUrl: `${PLATFORM_URL}/docs`,
      privacyPolicyUrl: `${PLATFORM_URL}/privacy`,
      termsOfServiceUrl: `${PLATFORM_URL}/terms`,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Output formatting
// ─────────────────────────────────────────────────────────────────────────────

function formatForRegistry(entry: RegistryEntry, registry: { name: string; url: string; description: string }): string {
  return `
═════════════════════════════════════════════════════════════════════════════
REGISTRY: ${registry.name}
URL: ${registry.url}
DESCRIPTION: ${registry.description}
═════════════════════════════════════════════════════════════════════════════

TOOL: ${entry.name}
DESCRIPTION: ${entry.description}
CATEGORY: ${entry.category}
TAGS: ${entry.tags.join(', ')}
PRICE: ${entry.priceUsdc} USDC${entry.priceUsdc === 0 ? ' (free)' : ''}
MCP_ENDPOINT: ${entry.endpoint}
MCP_METHOD: ${entry.method}
INPUT_SCHEMA: ${JSON.stringify(entry.inputSchema, null, 2)}

FIELD_MAPPINGS:
  name: ${entry.name}
  description: ${entry.description}
  tags: ${entry.tags.join(', ')}
  price_usdc: ${entry.priceUsdc}
  endpoint: ${entry.endpoint}
  input_schema: ${JSON.stringify(entry.inputSchema)}

CONTACT: ${entry.contactEmail}
WEBSITE: ${entry.website}
DOCS: ${entry.documentationUrl}
PRIVACY: ${entry.privacyPolicyUrl}
TERMS: ${entry.termsOfServiceUrl}

INSTRUCTIONS:
1. Visit ${registry.url}
2. Click "Add Server" / "Submit Tool" / "Register MCP Server"
3. Fill in the fields above using the FIELD_MAPPINGS section
4. For input_schema, paste the JSON object exactly as shown
5. Submit and wait for approval
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('PABANDI AGENT DISCOVERY & MONETIZATION — REGISTRY SUBMISSION GENERATOR');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  console.log('Discovering MCP tools from', MCP_BASE, '...');
  const tools = await fetchMcpTools();
  console.log(`Found ${tools.length} tool(s):`);
  tools.forEach((t) => console.log(`  - ${t.name}: ${t.description}`));
  console.log('');

  const entries = buildRegistryEntries(tools);

  for (const registry of REGISTRIES) {
    console.log(`\n═══════════════════════════════════════════════════════════════════════════════`);
    console.log(`REGISTRY: ${registry.name}`);
    console.log(`URL: ${registry.url}`);
    console.log(`═══════════════════════════════════════════════════════════════════════════════\n`);

    for (const entry of entries) {
      console.log(formatForRegistry(entry, registry));
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═════════════════════════════════════════════════════════════════════════════════');
  console.log(`Total tools: ${entries.length}`);
  console.log(`Total registry submissions: ${entries.length * REGISTRIES.length}`);
  console.log(`\nPer registry:`);
  for (const registry of REGISTRIES) {
    console.log(`  ${registry.name}: ${entries.length} tool(s) → ${registry.url}`);
  }
  console.log('\nNext steps:');
  console.log('  1. Copy each tool block above into the corresponding registry submission form.');
  console.log('  2. Ensure the MCP server is running at:', MCP_SERVER_URL);
  console.log('  3. Verify each tool responds to tools/call with the expected input schema.');
  console.log('  4. Monitor registry approval and update listings as tools evolve.');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  logger.error('[submit-registries] Failed:', err);
  process.exit(1);
});
