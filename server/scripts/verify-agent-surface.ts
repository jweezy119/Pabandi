#!/usr/bin/env npx tsx
/**
 * verify-agent-surface.ts — the honesty check.
 *
 * Everything Pabandi publishes to agents is a promise: the llms.txt tool table,
 * the server.json manifest, the /.well-known/* manifests, and the setup
 * checklist returned by POST /api/v1/agents/register. A promise that 404s or
 * names a tool that does not exist costs more trust than having no docs at all.
 *
 * This asserts, without a database or network:
 *   1. every MCP tool name is unique and stable (mcpName, not derived from copy)
 *   2. every tool advertised in server.json actually exists in tools/list
 *   3. every tool advertised in llms.txt actually exists in tools/list
 *   4. every HTTP endpoint advertised in the tool registry is mounted in index.ts
 *   5. every curl in the signup checklist and llms.txt resolves to a mounted route
 *
 * Run: npm run verify:agent-surface
 */
import fs from 'fs';
import path from 'path';
import { TOOLS } from '../src/mcp/pabandiMcpServer';
import { pabandiToolsRegistry } from '../src/services/pabandiTools.service';
import { AGENT_API_BASE, AGENT_MCP_URL } from '../src/mcp/agentEndpoint';
import { PTP_RISK_BANDS } from '../src/protocol/ptp.spec';

const ROOT = path.join(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const failures: string[] = [];
const notes: string[] = [];
const fail = (msg: string) => failures.push(msg);

// ── 1. tool names are unique + explicitly named ────────────────────────────────
const seen = new Set<string>();
for (const t of TOOLS as any[]) {
  if (seen.has(t.name)) fail(`duplicate MCP tool name: ${t.name}`);
  seen.add(t.name);
  if (!/^pabandi_[a-z0-9_]+$/.test(t.name)) {
    fail(`tool name is not a clean snake_case identifier: ${t.name}`);
  }
}

const registryWithoutName = pabandiToolsRegistry.filter((t: any) => !t.mcpName);
if (registryWithoutName.length > 0) {
  fail(`registry entries missing mcpName: ${registryWithoutName.map((t: any) => t.name).join(', ')}`);
}

// ── 2/3. documented tools exist ───────────────────────────────────────────────
const serverJson = JSON.parse(read('server.json'));
for (const t of serverJson.tools ?? []) {
  if (!seen.has(t.name)) fail(`server.json advertises unknown tool: ${t.name}`);
}

const llms = read('llms.txt');
const llmsToolNames = [...new Set(llms.match(/pabandi_[a-z0-9_]+/g) ?? [])];
for (const n of llmsToolNames) {
  if (!seen.has(n)) fail(`llms.txt advertises unknown tool: ${n}`);
}

// ── 2b. the manifests you SUBMIT TO DIRECTORIES ──────────────────────────────
//
// server.json was checked. The three files you actually hand to Smithery,
// pay.sh and Cloudflare were not — so they carried three tools the server has
// never served (`pabandi_verify_property`, `pabandi_initiate_escrow`,
// `pabandi_create_booking`) and the whole check still printed a green tick.
// A directory listing is the most-read document in this repo; it gets the same
// scrutiny as llms.txt, plus its own endpoint check.
const MANIFESTS = [
  'server.json',
  'mcp-worker/server.json',
  'registry/smithery.json',
  'registry/pay-sh.json',
  'registry/cloudflare-x402.json',
  '.well-known/agents.json',
  'launch/mcp-manifest.json',
];

for (const rel of MANIFESTS) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    fail(`manifest missing: ${rel}`);
    continue;
  }
  let doc: any;
  try {
    doc = JSON.parse(read(rel));
  } catch (e: any) {
    fail(`manifest ${rel} is not valid JSON: ${e.message}`);
    continue;
  }

  // Tool names: accept either the object form ({name,description}) or the bare
  // string form, since directories disagree about which shape they want.
  //
  // Completeness is only asserted when the document actually declares `tools`.
  // `.well-known/agents.json` declares `capabilities` instead, so it has no tool
  // list to be incomplete about.
  const listed: string[] = (doc.tools ?? []).map((t: any) => (typeof t === 'string' ? t : t?.name));
  for (const n of listed) {
    if (n && !seen.has(n)) fail(`${rel} advertises unknown tool: ${n}`);
  }
  if (Array.isArray(doc.tools)) {
    const missing = [...seen].filter((n) => !listed.includes(n));
    if (missing.length > 0) {
      fail(`${rel} omits ${missing.length} live tool(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
    }
  }

  // Every endpoint this manifest hands to a directory must be the real one.
  // A listing pointing at the dead host or at the SPA fallback is worse than no
  // listing: it survives review and fails on the developer's first call.
  const urls = JSON.stringify(doc).match(/https?:\/\/[^"'\\,\s]+/g) ?? [];
  for (const u of urls) {
    // workers.dev was the fabricated edge stub; it is not a published surface.
    if (u.includes('workers.dev')) {
      fail(`${rel} advertises a workers.dev endpoint (${u}) — the edge stub is not a published surface`);
    }
    // pabandi.com/mcp is the marketing SPA answering with index.html over a 200.
    // Only URLs that CLAIM to be the MCP endpoint are checked for equality with
    // the live one. `homepage: https://pabandi.com` is correct and must not be
    // flagged — pabandi.com is the marketing site. What must not ship is
    // pabandi.com/mcp, which no MCP client can speak to.
    if (/\/mcp\b/.test(u) && u !== AGENT_MCP_URL) {
      fail(`${rel} points its MCP endpoint at ${u}, but the configured endpoint is ${AGENT_MCP_URL}`);
    }
  }

  // A price for a tool that does not exist, or a paid tool with no price.
  const pricing = doc.pricing ?? Object.fromEntries(
    (doc.tools ?? [])
      .filter((t: any) => typeof t === 'object' && t.price && t.price !== 'free')
      .map((t: any) => [t.name, t.price]),
  );
  for (const name of Object.keys(pricing ?? {})) {
    if (!seen.has(name)) fail(`${rel} quotes a price for unknown tool: ${name}`);
  }

  // If a document publishes risk bands, they must be PTP's. `riskBand` once had
  // four incompatible definitions, including an "F" that no engine produces, so
  // an agent that learned the bands from the wrong source would be reasoning
  // about a tier that does not exist.
  if (doc.risk_bands) {
    const canonical = Object.keys(PTP_RISK_BANDS);
    const published = doc.risk_bands as string[];
    const extra = published.filter((b) => !canonical.includes(b));
    const absent = canonical.filter((b) => !published.includes(b));
    if (extra.length > 0) {
      fail(`${rel} publishes risk band(s) PTP does not define: ${extra.join(', ')} (canonical: ${canonical.join(', ')})`);
    }
    if (absent.length > 0) {
      fail(`${rel} omits PTP risk band(s): ${absent.join(', ')}`);
    }
  }
}

// ── 4/5. advertised endpoints are mounted ─────────────────────────────────────
const index = read('server/src/index.ts');
const v1 = 'v1';
const mounted = new Set<string>();
const addMount = (frag: string) => mounted.add(frag.replace(/\/$/, '') || '/');
for (const m of index.matchAll(/`\/api\/\$\{v\}([^`]*)`/g)) addMount(m[1]);
for (const m of index.matchAll(/app\.use\(`\/api\/\$\{v\}([^`]*)`/g)) addMount(m[1]);
// express-style sub-paths registered inside a router (e.g. agentDiscovery declares /.well-known/agent-registry.json)
for (const m of index.matchAll(/'\/(\.well-known\/[^']+)'/g)) mounted.add('/' + m[1]);
mounted.add('/.well-known');
mounted.add('/mcp');

const isMounted = (p: string): boolean => {
  // normalize: strip query, trailing slash, trailing quote/comma noise
  const clean = p
    .split('?')[0]
    .replace(/['\"`,;)\s].*$/, '')
    .replace(/\/+$/, '')
    // drop the /api/vN version prefix so both sides compare as router sub-paths
    .replace(/^\/api\/v\d+/, '') || '/';
  return [...mounted].some((m) => clean === m || clean.startsWith(m + '/'));
};

for (const t of pabandiToolsRegistry) {
  for (const ep of t.endpoints) {
    if (!isMounted(ep.path)) fail(`registry tool ${t.name} advertises unmounted endpoint: ${ep.method} ${ep.path}`);
  }
}

for (const raw of [...llms.matchAll(/https:\/\/[^)\s"']*?(?=\s|$)/g)].map((m) => m[0])) {
  const pathPart = raw.replace(/^https?:\/\/[^/]+/, '').replace(/['`,\s].*$/, '');
  if (!pathPart.startsWith('/api') && !pathPart.startsWith('/.well-known') && pathPart !== '/mcp') continue;
  if (pathPart.includes('{')) continue; // templated path, checked manually
  if (!isMounted(pathPart)) fail(`llms.txt advertises unmounted endpoint: ${raw}`);
}

// Signup checklist curls (paths only — the URLs are templated on the host).
const signup = read('server/src/routes/agentSignup.routes.ts');
for (const m of signup.matchAll(/https:\/\/pabandi\.com(\/[^\s\\]*)/g)) {
  const p = m[1].replace(/['`,\s].*$/, '').replace(/\/$/, '');
  // static docs (/llms.txt, /openapi.yaml) are served by the SPA/static layer, not routeMap
  if (!/^\/(api|\.well-known|mcp)/.test(p)) continue;
  if (!isMounted(p)) fail(`signup checklist advertises unmounted endpoint: ${p}`);
}

// ── 6. live probe (opt-in): do the advertised URLs actually answer? ──────────
// Static checks pass while a domain 404s, serves HTML for a JSON endpoint, or
// points at a host that no longer resolves. Only runs with --live.
async function liveProbe() {
  const llmsText = read('llms.txt');
  const base = AGENT_API_BASE;
  const targets: Array<[string, string]> = [
    ['GET', `${base}/llms.txt`],
    ['GET', `${base}/openapi.yaml`],
    ['GET', `${base}/robots.txt`],
    ['GET', `${base}/healthz`],
    ['GET', `${base}/api/v1/pabandi/tools`],
    ['POST', `${base}/api/v1/agents/register`],
  ];
  for (const [method, url] of targets) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ agentHandle: `probe-${Date.now()}`, ownerEmail: `probe-${Date.now()}@example.com`, name: 'Probe' }) } : {}),
      });
      const type = res.headers.get('content-type') || '';
      const body = await res.text();
      const looksHtml = type.includes('text/html');
      if (res.status >= 500) {
        fail(`live ${method} ${url} → HTTP ${res.status}`);
      } else if (looksHtml) {
        // The SPA fallback answers anything unknown with index.html, which looks
        // like success to a crawler. A discovery file served as HTML is a lie.
        fail(`live ${method} ${url} returned HTML instead of a real ${url.endsWith('.yaml') ? 'YAML spec' : 'response'}`);
      } else if (url.endsWith('.yaml') && !type.includes('yaml') && !type.includes('octet')) {
        fail(`live ${url} content-type is ${type}, expected YAML`);
      }
      console.log(`  ${res.status}${looksHtml ? ' HTML!' : ''} ${method} ${url}`);
    } catch (e: any) {
      fail(`live ${method} ${url} unreachable — ${e.message}`);
    }
  }
  // Compare PARSED HOSTNAMES, not substrings.
  //
  // The old check was `!host.includes('pabandi.onrender.com')`, which passes for
  // 'https://pabandi.onrender.com.evil.example' and for
  // 'https://evil.example/pabandi.onrender.com' — i.e. it would have reported our own
  // domain being hijacked as fine. CodeQL flagged it as
  // js/incomplete-url-substring-sanitization.
  //
  // It was also silently disabled: with PUBLIC_API_URL unset the fallback argument was
  // '//', every absolute URL contains '//', so `!host.includes('//')` was always false
  // and the check never fired. Two independent ways for it to not do its job.
  const advertised = llmsText.match(/https?:\/\/[^/\s]+/)?.[0];
  if (advertised) {
    const expected = new URL(base).hostname;
    let actual: string | null = null;
    try {
      actual = new URL(advertised).hostname;
    } catch {
      actual = null;
    }
    if (actual !== expected) {
      notes.push(`llms.txt advertises host ${advertised}; live base is ${base}`);
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────
async function main() {
console.log(`MCP tools exposed : ${(TOOLS as any[]).length}`);
console.log(`registry entries  : ${pabandiToolsRegistry.length}`);
console.log(`llms.txt tool refs: ${llmsToolNames.length}`);

const undocumented = (TOOLS as any[]).filter((t) => !llmsToolNames.includes(t.name));
if (undocumented.length > 0) {
  notes.push(`tools not documented in llms.txt: ${undocumented.map((t) => t.name).join(', ')}`);
}

for (const n of notes) console.log(`NOTE  ${n}`);

if (process.argv.includes('--live')) {
  console.log('\nlive probe:');
  await liveProbe();
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} agent-surface problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
  return;
}
console.log('\n✓ every advertised agent-facing promise resolves to a real tool or mounted route');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
