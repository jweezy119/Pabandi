/**
 * pabandiMcpServer.ts — MCP distribution layer.
 *
 * Tools:
 *   1. pabandi_verify_passport     — verify PTP attestation (public)
 *   2. pabandi_discover             — PTP discovery doc (public)
 *   3. pabandi_get_ledger           — audit passport issuance charge (public)
 *   4. pabandi_issue_passport       — issue scoped metered passport (owner/auth)
 *   5. pabandi_discover_platform    — full Pabandi Platform doc
 *   6. pabandi_platform_access      — check caller access to a given tool
 *   7..N pabandi_<short>            — REAL platform HTTP proxy (calls canonical
 *                                     /api/v1/... endpoints server-side)
 *
 * Mounted at POST /mcp (Streamable HTTP).
 */
import { Request, Response } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { passportEconomy, validateCapabilities, PTPRiskBand } from '../services/passportEconomy.service';
import { PAB_FEE_PER_PASSPORT } from '../config/tokenomics';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { pabandiToolsRegistry, pabandiPlatformDoc, toolAccessOk } from '../services/pabandiTools.service';

const SERVER_NAME = 'pabandi-trust';
const SERVER_VERSION = '1.0.0';
const BACKEND = (process.env.BACKEND_URL || 'https://pabandi.onrender.com').replace(/\/+$/, '');

// ── Engine tools ──────────────────────────────────────────────────────────────
const ENGINE_TOOLS = [
  {
    name: 'pabandi_verify_passport',
    description: 'Verify a Pabandi PTP attestation (agent, business, individual, or trust rail). Input a base64-encoded attestation and optionally require a capability (e.g. "act:book"). Returns valid, granted capabilities, risk band, expiry. Offline-verifiable: re-executes HMAC-SHA512 over a fixed field subset.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Base64-encoded PTPAttestation or PTPAgentAttestation' },
        need: { type: 'string', description: 'Optional capability the subject must hold, e.g. "act:book"' },
      },
      required: ['token'],
    },
  },
  {
    name: 'pabandi_discover',
    description: 'Return the Pabandi Trust Protocol discovery document: public verify endpoint URL, protocol public key, issue endpoint, supported risk bands/entity types.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pabandi_get_ledger',
    description: 'Public audit lookup of a passport issuance charge by idempotency key. Returns fee ($PAB), owner, agent, risk band, capabilities.',
    inputSchema: { type: 'object', properties: { idempotencyKey: { type: 'string' } }, required: ['idempotencyKey'] },
  },
  {
    name: 'pabandi_issue_passport',
    description: 'Issue a scoped Agent Capability Passport. Capabilities are validated against owner trust band. Metered at PAB_FEE_PER_PASSPORT $PAB per issue (idempotent). Authentication required.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique id of the agent this passport is for' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'e.g. ["act:book","read"]' },
        idempotencyKey: { type: 'string', description: 'Optional; retries with same key are not double-charged' },
      },
      required: ['agentId', 'capabilities'],
    },
  },
];

// ── Platform tools (real HTTP proxy) ─────────────────────────────────────────
const discoverPlatformTool = {
  name: 'pabandi_discover_platform',
  description: 'Discover the full Pabandi Platform: every tool, OpenAPI/spec URL, MCP endpoint, PTP endpoints, SDK info, access tiers, and live status.',
  inputSchema: { type: 'object', properties: {} },
  handler: () => pabandiPlatformDoc(),
};

const platformAccessTool = {
  name: 'pabandi_platform_access',
  description: 'Check whether the caller can access a given Pabandi platform tool (by MCP tool name). Returns ok + note.',
  inputSchema: {
    type: 'object',
    properties: { toolName: { type: 'string', description: 'MCP tool name, e.g. pabandi_search' } },
    required: ['toolName'],
  },
  handler: async (_args: any, req?: Request) => {
    const { toolName } = _args;
    const result = await toolAccessOk(toolName, req);
    return { ok: result.ok, note: result.reason, toolName };
  },
};

function jsonRpc(id: any, result?: any, error?: any) {
  return { jsonrpc: '2.0', id, result, error };
}

// ── Real HTTP proxy ───────────────────────────────────────────────────────────
async function callPlatformHttp(def: any, args: any, req?: Request): Promise<any> {
  const ep = def.endpoints[0];
  if (!ep) throw new Error(`no endpoint mapped for ${def.name}`);

  // 1) enforce structural access FIRST
  const accessResult = await toolAccessOk(def.name, req, {
    ownerUserId: (req as any)?.user?.id,
    businessId: args?.businessId,
    verifiedRail: false,
  });
  if (!accessResult.ok) {
    throw new Error(`access denied: ${accessResult.reason}`);
  }

  const method = ep.method.toUpperCase();
  const needsAuth = def.access !== 'public';
  let url = `${BACKEND}${ep.path}`;

  // Replace path params like :id or :businessId
  for (const [k, v] of Object.entries(args)) {
    url = url.replace(`:${k}`, String(v));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (needsAuth) {
    const authHeader = (req as any)?.headers?.authorization;
    if (authHeader) headers['Authorization'] = authHeader;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const fetchOpts: any = { method, headers, signal: controller.signal };
    if (!['GET', 'HEAD'].includes(method) && args && Object.keys(args).length) {
      fetchOpts.body = JSON.stringify(args);
    }
    const resp = await fetch(url, fetchOpts);
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: resp.status, ok: resp.ok, data, calledVia: 'mcp_proxy', endpoint: { method, path: ep.path, url } };
  } finally {
    clearTimeout(timer);
  }
}

// ── Per-tool proxy handlers ───────────────────────────────────────────────────
function buildPlatformToolDef(t: any) {
  const shortSlug = t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^pabandi_/, '');
  return {
    name: `pabandi_${shortSlug}`,
    description: (t.exclusiveNote ? t.description + ` [${t.access}] ${t.exclusiveNote}` : t.description) + ' This MCP tool makes a real HTTP call to the canonical Pabandi endpoint and returns the actual platform response.',
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.inputs).map(([k, desc]) => [k, { type: 'string', description: desc }]),
      ),
      required: Object.keys(t.inputs),
    },
    access: t.access,
    endpoints: t.endpoints,
    handler: async (args: any, req?: Request) => callPlatformHttp({ name: `pabandi_${shortSlug}`, access: t.access, endpoints: t.endpoints }, args, req),
  };
}

const PLATFORM_TOOL_DEFS = pabandiToolsRegistry
  .filter((t: any) => t.category !== 'sdk')
  .map((t: any) => buildPlatformToolDef(t));

const OWNER_TOOL_DEFS = pabandiToolsRegistry
  .filter((t: any) => t.access === 'owner' || t.access === 'verified' || t.access === 'exclusive')
  .map((t: any) => buildPlatformToolDef(t));

export const TOOLS = [
  ...ENGINE_TOOLS,
  discoverPlatformTool,
  platformAccessTool,
  ...PLATFORM_TOOL_DEFS,
  ...OWNER_TOOL_DEFS,
];

// ── Dispatch ──────────────────────────────────────────────────────────────────
async function dispatch(method: string, params: any, id: any, req?: Request): Promise<any> {
  switch (method) {
    case 'initialize':
      return jsonRpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case 'tools/list':
      return jsonRpc(id, { tools: TOOLS });

    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const out = await callTool(name, args, req);
        return jsonRpc(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false });
      } catch (e: any) {
        return jsonRpc(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }

    default:
      return jsonRpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  }
}

async function callTool(name: string, args: any, req?: Request): Promise<any> {
  // Engine-backed tools
  if (ENGINE_TOOLS.some((t) => t.name === name)) {
    switch (name) {
      case 'pabandi_verify_passport': {
        if (!args.token) throw new Error('token (base64 attestation) required');
        let att: any;
        try { att = JSON.parse(Buffer.from(args.token, 'base64').toString('utf-8')); } catch { throw new Error('token is not valid base64 JSON'); }
        return ptpEngine.verifyAgentPassport(att, args.need);
      }
      case 'pabandi_discover':
        return ptpEngine.getDiscoveryDocument(`${process.env.BACKEND_URL || ''}`);
      case 'pabandi_get_ledger': {
        if (!args.idempotencyKey) throw new Error('idempotencyKey required');
        const rec = await passportEconomy.lookup(args.idempotencyKey);
        if (!rec) throw new Error('no such issuance');
        return {
          idempotencyKey: rec.idempotencyKey, ownerUserId: rec.ownerUserId, agentId: rec.agentId,
          riskBand: rec.riskBand, feePab: rec.feePab, capabilities: rec.capabilities, chargedAt: rec.chargedAt,
        };
      }
      case 'pabandi_issue_passport': {
        const authUser = (req as any)?.user;
        if (!authUser?.id) throw new Error('authentication required: pass a Bearer token for the passport owner');
        const { agentId, capabilities, idempotencyKey } = args;
        if (!agentId || !Array.isArray(capabilities) || !capabilities.length) throw new Error('agentId and non-empty capabilities[] required');
        const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { trustScore: true } });
        if (!user) throw new Error('owner user not found');
        const score = user.trustScore || 70;
        const band = ptpEngine.scoreToRiskBand(score) as PTPRiskBand;
        const capCheck = validateCapabilities(band, capabilities);
        if (!capCheck.ok) throw new Error(`capability rejected: ${capCheck.reason}`);
        let charge;
        try { charge = await passportEconomy.chargeIssue({ ownerUserId: authUser.id, agentId, riskBand: band, capabilities, idempotencyKey }); }
        catch (e: any) { throw new Error(`issuance not recorded (not charged): ${e.message}`); }
        let velocity: any = { direction: 'STEADY', momentum: 0, confidence: 0.5 };
        try {
          const { trustFluxService } = await import('../services/trustFlux.service');
          const flux = await trustFluxService.computeTrustFlux(authUser.id);
          velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
        } catch { /* default */ }
        const att = ptpEngine.issueAgentPassport({ agentId, ownerUserId: authUser.id, capabilities, trustScore: score, velocity });
        return {
          attestation: att,
          token: Buffer.from(JSON.stringify(att)).toString('base64'),
          economics: { feePab: charge.feePab, alreadyCharged: charge.alreadyCharged, idempotencyKey: charge.idempotencyKey, riskBand: band, ledgerId: charge.record?.id },
        };
      }
    }
  }

  // Platform discovery + access tools
  if (name === 'pabandi_discover_platform') return discoverPlatformTool.handler();
  if (name === 'pabandi_platform_access') return platformAccessTool.handler(args, req);

  // Curated platform tool — proxy the real HTTP call server-side with inline access enforcement
  const def = PLATFORM_TOOL_DEFS.find((t) => t.name === name) || OWNER_TOOL_DEFS.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown MCP tool: ${name}. Run pabandi_discover_platform to see available tools.`);

  if (typeof (def as any).handler === 'function') {
    return (def as any).handler(args, req);
  }

  return callPlatformHttp(def, args, req);
}

/** Express handler for POST /mcp */
export const mcpHandler = async (req: Request, res: Response) => {
  optionalAuthenticate(req, res, async () => {
    const body = req.body;
    if (!body || body.jsonrpc !== '2.0') return res.status(400).json({ error: 'Invalid JSON-RPC 2.0 request' });
    if (body.method === 'notifications/initialized' || body.id === undefined) return res.status(202).end();
    try {
      const result = await dispatch(body.method, body.params || {}, body.id, req);
      res.setHeader('Content-Type', 'application/json');
      return res.json(result);
    } catch (e: any) {
      logger.error('[MCP] dispatch error', e);
      return res.json(jsonRpc(body.id, undefined, { code: -32603, message: e.message }));
    }
  });
};
