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
  const base = process.env.PUBLIC_API_URL || 'https://pabandi.onrender.com';
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
  const host = llmsText.match(/https?:\/\/[^/\s]+/)?.[0];
  if (host && !host.includes('pabandi.onrender.com') && !host.includes(process.env.PUBLIC_API_URL || '//')) {
    notes.push(`llms.txt advertises host ${host}; live base is ${base}`);
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
