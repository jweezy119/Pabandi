/**
 * agentEndpoint.ts — the ONE definition of where agents reach Pabandi.
 *
 * Every directory listing, registry payload, manifest, and SDK default is a
 * promise about a URL. This module exists because that promise was written out
 * five separate times and the copies disagreed:
 *
 *   server.json            → pabandi-mcp.pabandi-mcp-worker.workers.dev  (worker stub)
 *   registry/*.json        → pabandi-mcp.workers.dev/mcp                 (dead host)
 *   registry/smithery.json → https://api.pabandi.com                     (NXDOMAIN)
 *   submit-mcp-registries  → https://pabandi.com/mcp                     (SPA fallback)
 *   discovery.routes.ts    → PUBLIC_API_URL || pabandi.onrender.com      (correct)
 *
 * Only the last one answered a JSON-RPC request. The other four would have
 * shipped a listing that no MCP client could connect to — or, worse, connected
 * to the Cloudflare stub and been told its escrow was funded.
 *
 * `pabandi.com` is the marketing front end, not the API. Its SPA fallback
 * answers *any* path with index.html, so `pabandi.com/mcp` returns HTTP 200
 * with text/html and looks healthy to a naive liveness check. It is not an MCP
 * endpoint. Never publish it as one.
 *
 * `pabandi.onrender.com` is the origin Render serves, not the name agents should
 * be given. It stays a documented fallback for the window before DNS is live, but
 * it is not what appears in a directory listing: a listing is read months later,
 * and by then the hostname in it should be the one that will still exist.
 *
 * Override with PUBLIC_API_URL only when the API genuinely lives elsewhere.
 */
function normalize(base: string): string {
  return base.replace(/\/+$/, '');
}

/** The API host that serves /mcp, /llms.txt, /openapi.yaml and /api/v1/*. */
export const AGENT_API_BASE = normalize(
  process.env.PUBLIC_API_URL ||
    (process.env.PUBLIC_API_URL === ''
      ? `https://${process.env.RENDER_HOST || 'pabandi.onrender.com'}`
      : 'https://api.pabandi.com'),
);

/** The MCP endpoint to publish. Streamable HTTP JSON-RPC, POST only. */
export const AGENT_MCP_URL = `${AGENT_API_BASE}/mcp`;

/** Marketing/docs site. Never an API host. */
export const SITE_URL = normalize(process.env.PUBLIC_SITE_URL || 'https://pabandi.com');

/** Repo, used by every registry that wants a source link. */
export const REPO_URL = 'https://github.com/jweezy119/Pabandi';

/**
 * The schema the manifests claim to satisfy. Kept here so a version bump is one
 * edit: the manifest generators write the URL, the verify script asserts the
 * URL, and nothing hardcodes it.
 */
export const MCP_REGISTRY_SCHEMA =
  'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';