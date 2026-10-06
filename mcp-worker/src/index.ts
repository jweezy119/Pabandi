/**
 * mcp-worker/src/index.ts — Cloudflare Worker edge for the PabandiOS MCP server.
 *
 * WHAT THIS IS: a thin, stateless reverse proxy to the canonical MCP server at
 * BACKEND_URL. It answers `initialize` and `resources/list` locally (cheap,
 * no upstream needed) and forwards every `tools/*` call verbatim.
 *
 * WHAT THIS IS NOT, and why it used to be a problem:
 *
 * This file previously implemented 7 tools itself, and six of them returned
 * invented data. `pabandi_verify_passport` returned `{ valid: true, riskBand: 'C' }`
 * unconditionally for ANY token — including a forged one — because the comment
 * read "In production: verify HMAC signature server-side". `pabandi_initiate_escrow`
 * returned `status: 'ACTIVE'` and an `escrow_${Date.now()}` id for funds it never
 * locked. `pabandi_get_ledger` returned `found: false` for every key.
 *
 * Every registry manifest pointed here. So the directory listing, the Cloudflare
 * edge, and the API disagreed about what escrow was, and the least truthful of
 * the three was the one a new developer would talk to first. For a product whose
 * entire claim is verifiable trust, an escrow endpoint that reports success for
 * money that was never held is the single most expensive possible bug.
 *
 * The rule now: this worker never asserts a fact about the world. It forwards,
 * or it fails loudly. There is no fallback response, because a fabricated
 * fallback is indistinguishable from a real one to the calling agent.
 */

export interface Env {
  BACKEND_URL: string;
  NODE_ENV: string;
  SOLANA_USDC_ADDRESS?: string;
}

const SERVER_NAME = 'pabandi-trust';
const SERVER_VERSION = '1.0.0';
const PROTOCOL_VERSION = '2024-11-05';

const UPSTREAM_TIMEOUT_MS = 30_000;

function jsonRpc(id: any, result?: any, error?: any) {
  return { jsonrpc: '2.0', id, result, error };
}

function rpcError(id: any, code: number, message: string, data?: unknown) {
  return jsonRpc(id, undefined, { code, message, ...(data !== undefined ? { data } : {}) });
}

/** JSON-RPC error codes. -32000 is the implementation-defined server-error range. */
const RPC_INTERNAL = -32603;
const RPC_UPSTREAM_UNAVAILABLE = -32000;

function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment, Mcp-Session-Id, Mcp-Protocol-Version',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status: number, origin: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...extra },
  });
}

/**
 * Headers worth carrying through to the caller. `Mcp-Session-Id` is the one that
 * matters for Streamable HTTP: if the edge silently drops it, a client that
 * opened a session cannot correlate its follow-up calls and retries forever.
 * `WWW-Authenticate` is forwarded so a 401 from the API reaches the agent as a
 * 401 rather than an opaque edge failure.
 */
const FORWARDED_RESPONSE_HEADERS = ['mcp-session-id', 'www-authenticate', 'mcp-protocol-version'];

async function forward(req: Request, env: Env, payload: unknown, origin: string): Promise<Response> {
  const upstream = `${env.BACKEND_URL.replace(/\/+$/, '')}/mcp`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // The Streamable HTTP spec requires clients to offer both; some upstreams
    // reject a request that does not.
    Accept: 'application/json, text/event-stream',
  };
  // Forward caller credentials so the API — not the edge — decides authorization.
  for (const h of ['authorization', 'x-payment', 'x-api-key', 'x-agent-passport']) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    // Fail LOUDLY. Never synthesise a success here — an agent must be able to
    // distinguish "escrow is funded" from "the edge could not reach the API".
    const aborted = err?.name === 'AbortError';
    return json(
      rpcError(
        (payload as any)?.id ?? null,
        RPC_UPSTREAM_UNAVAILABLE,
        aborted
          ? `Pabandi API did not respond within ${UPSTREAM_TIMEOUT_MS}ms. No action was taken.`
          : `Pabandi API is unreachable from the edge. No action was taken. (${err?.message ?? 'unknown error'})`,
        { upstream, retryable: true },
      ),
      503,
      origin,
      { 'Retry-After': '5' },
    );
  } finally {
    clearTimeout(timer);
  }

  const passthrough: Record<string, string> = {};
  for (const h of FORWARDED_RESPONSE_HEADERS) {
    const v = res.headers.get(h);
    if (v) passthrough[h] = v;
  }
  return new Response(res.body, {
    status: res.status,
    headers: { ...corsHeaders(origin), ...passthrough },
  });
}

async function handleMCP(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('Origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json(rpcError(null, -32600, 'Invalid Request: this endpoint accepts POST only.'), 405, origin);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error: body is not valid JSON.'), 400, origin);
  }
  if (body?.jsonrpc !== '2.0' || !body.method) {
    return json(rpcError(body?.id ?? null, -32600, 'Invalid Request: expected {"jsonrpc":"2.0","method":...}.'), 400, origin);
  }

  const { id, method, params } = body;

  try {
    switch (method) {
      // Local-only handshake. Answering this without a round trip is the whole
      // reason to have an edge at all.
      case 'initialize':
        return json(
          jsonRpc(id, {
            protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            instructions:
              'PabandiOS — trust and settlement for AI agents. Call pabandi_platform_discovery first to learn every tool, its access tier, and the endpoint that serves it. Paid tools return a JSON-RPC 402 error with an x402 payment requirement; satisfy it and retry the same call.',
          }),
          200,
          origin,
        );

      // Notifications take no response body per JSON-RPC. 202 + empty is correct.
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return new Response(null, { status: 202, headers: corsHeaders(origin) });

      // This server has no resources. Saying so explicitly beats an empty result
      // that a client may retry forever.
      case 'resources/list':
        return json(jsonRpc(id, { resources: [] }), 200, origin);
      case 'resources/templates/list':
        return json(jsonRpc(id, { resourceTemplates: [] }), 200, origin);
      case 'prompts/list':
        return json(jsonRpc(id, { prompts: [] }), 200, origin);

      // Everything else — tools/list, tools/call, ping — is the API's business.
      case 'tools/list':
      case 'tools/call':
      case 'ping':
        return await forward(req, env, body, origin);

      default:
        return json(
          rpcError(id ?? null, -32601, `Method not found: ${method}. This server exposes tools/list, tools/call, and ping.`),
          404,
          origin,
        );
    }
  } catch (err: any) {
    return json(rpcError(id ?? null, RPC_INTERNAL, `Edge handler failed: ${err?.message ?? 'unknown error'}`), 500, origin);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handleMCP(req, env);
    } catch (err: any) {
      // Last-resort net: still a well-formed JSON-RPC error, never a bare 500
      // that an agent would have to guess the meaning of.
      return new Response(
        JSON.stringify(rpcError(null, RPC_INTERNAL, 'Edge error.', { message: err?.message ?? 'unknown' })),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req.headers.get('Origin') || '*') } },
      );
    }
  },
};