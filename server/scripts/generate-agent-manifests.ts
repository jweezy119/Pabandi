#!/usr/bin/env npx tsx
/**
 * generate-agent-manifests.ts — generate every agent-facing manifest from the
 * live tool registry. Do not hand-edit the output.
 *
 * There used to be five hand-maintained manifests with three different tool
 * lists between them. The directory copies advertised `pabandi_verify_property`,
 * `pabandi_initiate_escrow` and `pabandi_create_booking` — none of which exist
 * on the server — while the server's own `server.json` listed the real 20. So
 * the thing you submit to Smithery was not the thing that answers.
 *
 * Two root causes, both fixed here:
 *   1. the tool list was copied, so it drifted. Now it is read from TOOLS.
 *   2. the endpoint was typed by hand into 5 files. Now it comes from
 *      agentEndpoint.ts, which is the same source /.well-known/api-host serves.
 *
 * Writes: server.json, mcp-worker/server.json, registry/*.json
 * Run:    npm run generate:manifests
 * Verify: npm run verify:agent-surface  (fails if anything above drifts)
 */
import fs from 'fs';
import path from 'path';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import {
  AGENT_API_BASE,
  AGENT_MCP_URL,
  MCP_REGISTRY_SCHEMA,
  REPO_URL,
  SITE_URL,
} from '../src/mcp/agentEndpoint';
import { buildAgentsDoc } from '../src/mcp/agentsDoc';

const ROOT = path.join(__dirname, '..', '..');

type Tool = { name: string; description: string; access?: string };

const tools = TOOLS as Tool[];

/**
 * Registry descriptions are length-capped by most directories. Truncate on a
 * word boundary so a listing never ends mid-word, and strip the boilerplate
 * suffix the server appends ("This MCP tool makes a real HTTP call to the
 * canonical Pabandi endpoint...") which wastes a listing's most valuable
 * characters on an implementation note.
 */
function listingDescription(t: Tool): string {
  let d = String(t.description ?? '')
    .replace(/\s*This MCP tool makes a real HTTP call to the canonical Pabandi endpoint and returns the actual platform response\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (d.length <= 400) return d;
  const cut = d.slice(0, 400);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** The paid tools, derived from the price table rather than restated. */
const PAID_TOOLS: Record<string, number> = {
  pabandi_issue_passport: 1.0,
  pabandi_start_escrow: 0.5,
  pabandi_book_stay: 0.25,
};
const knownTools = new Set(tools.map((t) => t.name));
for (const name of Object.keys(PAID_TOOLS)) {
  if (!knownTools.has(name)) {
    throw new Error(
      `generate-agent-manifests: priced tool "${name}" is not in tools/list. ` +
        `Either the tool was renamed or the price table is stale. Fix the price, do not publish a price for a tool that does not exist.`,
    );
  }
}

const priceLabel = (t: Tool): string => {
  const usd = PAID_TOOLS[t.name];
  return usd ? `${usd} USDC` : 'free';
};

const shortDescription = [
  'Trust and settlement layer for AI agents: portable trust attestations (PTP),',
  'reputation risk bands, escrow, and x402/USDC payments on Solana.',
].join(' ');

const payment = { scheme: 'x402', network: 'solana', currency: 'USDC' };
const authorization = { scheme: 'ap2', mandates: ['intent', 'cart', 'payment'] };
const toolEntries = tools.map((t) => ({ name: t.name, description: listingDescription(t) }));

/** The MCP registry server.json shape, shared by the repo root and the worker. */
const serverJson = {
  $schema: MCP_REGISTRY_SCHEMA,
  name: 'io.github.jweezy119/Pabandi',
  title: 'PabandiOS',
  description: shortDescription,
  version: '1.0.0',
  repository: { url: REPO_URL, source: 'github' },
  remotes: [{ type: 'streamable-http', url: AGENT_MCP_URL }],
  tools: toolEntries,
  payment,
  authorization,
};

const registrySmithery = {
  name: 'pabandi-mcp',
  version: '1.0.0',
  description: shortDescription,
  // Smithery hosted config. The previous entry here was
  // `npx -y @pabandi/mcp`, a package that has never been published — an install
  // command that fails on the first try, which is the single fastest way to
  // lose a developer. The remote below is the real, already-deployed endpoint.
  remotes: [{ type: 'streamable-http', url: AGENT_MCP_URL }],
  capabilities: { tools: { listChanged: false } },
  tools: toolEntries,
  payment,
  authorization,
  repository: REPO_URL,
  homepage: SITE_URL,
  docs: `${AGENT_API_BASE}/llms.txt`,
  license: 'MIT',
  keywords: [
    'mcp', 'x402', 'escrow', 'trust', 'solana', 'agent', 'booking',
    'reputation', 'agent-payments', 'a2a',
  ],
};

const registryPaySh = {
  name: 'pabandi-mcp',
  slug: 'pabandi-mcp',
  description: shortDescription,
  url: AGENT_MCP_URL,
  mcp_url: AGENT_MCP_URL,
  payment,
  authorization,
  pricing: Object.fromEntries(
    tools.filter((t) => PAID_TOOLS[t.name]).map((t) => [t.name, priceLabel(t)]),
  ),
  tools: toolEntries.map((t) => t.name),
  repository: REPO_URL,
  license: 'MIT',
};

const registryCloudflare = {
  name: 'pabandi-mcp',
  description: shortDescription,
  url: AGENT_MCP_URL,
  // The old recipient was the literal placeholder string "PABANDI_USDC_WALLET".
  // Publishing that invites an integrator to send real funds to nowhere.
  recipient: process.env.SOLANA_USDC_ADDRESS || 'UNSET — see /.well-known/agents.json',
  payment,
  tools: toolEntries.map((t) => ({ name: t.name, price: priceLabel(t), description: t.description })),
  authorization,
};

/**
 * The registry submission manifest. Same shape as the published server.json but
 * carrying submission metadata: keywords for search, and the description written
 * for a directory reader rather than for an agent mid-call.
 */
const launchManifest = {
  $schema: MCP_REGISTRY_SCHEMA,
  name: 'io.github.jweezy119/Pabandi',
  title: 'PabandiOS',
  description: shortDescription,
  version: '1.0.0',
  repository: { url: REPO_URL, source: 'github' },
  homepage: SITE_URL,
  documentation: `${AGENT_API_BASE}/llms.txt`,
  remotes: [{ type: 'streamable-http', url: AGENT_MCP_URL }],
  packages: [],
  tools: toolEntries,
  keywords: [
    'trust', 'escrow', 'reputation', 'agent-payments', 'x402', 'a2a',
    'mcp', 'model-context-protocol', 'solana', 'usdc', 'verifiable-credentials',
    'agent-economy', 'booking', 'kyc',
  ],
  payment,
  authorization,
};

const files: Array<[string, unknown]> = [
  ['server.json', serverJson],
  ['mcp-worker/server.json', serverJson],
  ['registry/smithery.json', registrySmithery],
  ['registry/pay-sh.json', registryPaySh],
  ['registry/cloudflare-x402.json', registryCloudflare],
  // The checked-in reference copy of the capability manifest. It was hand-kept
  // and drifted to a dead host and a capability the server does not serve.
  ['.well-known/agents.json', buildAgentsDoc(AGENT_API_BASE)],
  // The submission manifest under review for the launch. Generated rather than
  // hand-written so the registry copy cannot describe a server that has changed.
  ['launch/mcp-manifest.json', launchManifest],
];

const CHECK = process.argv.includes('--check');
let drift = 0;

for (const [rel, content] of files) {
  const abs = path.join(ROOT, rel);
  const next = `${JSON.stringify(content, null, 2)}\n`;
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  if (current === next) {
    console.log(`  ok      ${rel}`);
    continue;
  }
  if (CHECK) {
    console.error(`  DRIFT   ${rel} — regenerate with: npm run generate:manifests`);
    drift++;
    continue;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next);
  console.log(`  wrote   ${rel}`);
}

console.log(`\n${tools.length} tools → ${files.length} manifests → ${AGENT_MCP_URL}`);
if (drift > 0) {
  console.error(`\n✗ ${drift} manifest(s) out of date.`);
  process.exitCode = 1;
}