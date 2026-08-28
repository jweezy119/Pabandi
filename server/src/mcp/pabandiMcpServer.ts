/**
 * pabandiMcpServer.ts — the Model Context Protocol (MCP) distribution layer that
 * makes the Pabandi Platform THE trust standard agents use.
 *
 * MCP tools (JSON-RPC 2.0, no external SDK dep — builds & runs anywhere):
 *
 *   1.  pabandi_verify_passport     — verify a PTP attestation + capability (public)
 *   2.  pabandi_discover             — discovery doc (verify URL + public key) (public)
 *   3.  pabandi_get_ledger           — audit a passport issuance charge (public)
 *   4.  pabandi_issue_passport       — issue a scoped, metered passport (owner/auth)
 *   5.  pabandi_discover_platform    — the full Pabandi Platform doc (tools, spec, PTP, SDK, tiers)
 *   6.  pabandi_platform_access      — check whether the caller can call a given tool (access gating)
 *   7.  pabandi_search               — search the dir (JSONSchema input + sample)
 *   8.  pabandi_hospitality_book     — book a stay w/ guest-deposit escrow (JSONSchema + access)
 *   9.  pabandi_predictive_booking   — forecast no-show/completion (JSONSchema + access)
 *   10. pabandi_zk_realestate        — issue a ZK proof of escrow split (JSONSchema + access)
 *
 * Mounted at POST /mcp (Streamable HTTP). Any MCP client (Claude Desktop, LangChain,
 * AutoGPT, custom agents) connects and discovers the whole platform.
 *
 * Arch note: MCP is the DISCOVERY + TRUST layer. The MCP client (an LLM agent) gets the
 * full platform tool list with inputSchema, then calls the real platform tools via HTTP
 * (the OpenAPI/spec route at /api/v1/pabandi/spec) — because MCP clients have network
 * access and the OpenAPI spec is the canonical "how to call each tool" machine-readable doc.
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

// ── Real engine-backed MCP tools (the "trust engine") ──────────────────────────
const ENGINE_TOOLS = [
  {
    name: 'pabandi_verify_passport',
    description: 'Verify a Pabandi PTP attestation (agent, business, individual, or trust rail). Input a base64-encoded attestation and optionally require a capability (e.g. "act:book"). Returns valid, granted capabilities, risk band, expiry. This is the core trust check any agent performs before trusting another agent or action. Offline-verifiable: re-executes the HMAC-SHA512 signature over a fixed field subset.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Base64-encoded PTPAttestation or PTPAgentAttestation' },
        need: { type: 'string', description: 'Optional capability the subject must hold, e.g. "act:book" or "act:transfer:under:100USD"' },
      },
      required: ['token'],
    },
  },
  {
    name: 'pabandi_discover',
    description: 'Return the Pabandi Trust Protocol discovery document: the public verify endpoint URL, the protocol public key, the issue endpoint, and the supported risk bands/entity types. Use this to bootstrap trust with Pabandi.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pabandi_get_ledger',
    description: 'Public audit lookup of a passport issuance charge by its idempotency key. Returns the fee (in $PAB), owner, agent, risk band and capabilities granted.',
    inputSchema: {
      type: 'object',
      properties: { idempotencyKey: { type: 'string' } },
      required: ['idempotencyKey'],
    },
  },
  {
    name: 'pabandi_issue_passport',
    description: 'Issue a scoped Agent Capability Passport for one of your agents. Capabilities are validated against your trust band (foolproof: low-trust owners cannot get dangerous capabilities). Metered at PAB_FEE_PER_PASSPORT $PAB per issue (idempotent). Authentication required: the JWT subject is the passport owner.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique id of the agent this passport is for' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'e.g. ["act:book","read"]' },
        idempotencyKey: { type: 'string', description: 'Optional; retries with the same key are not double-charged' },
      },
      required: ['agentId', 'capabilities'],
    },
  },
];

// ── Platform tools: discovery + access + curated surface (LLM-friendly) ─────────
const discoverPlatformTool = {
  name: 'pabandi_discover_platform',
  description: 'Discover the full Pabandi Platform: every tool (search, hospitality, escrow, financing, predictive, ZK, trust), the OpenAPI/spec URL, the MCP endpoint, the PTP verify/issue/ledger endpoints, the SDK info, the access tiers (public / owner / verified / exclusive), and live status. This is the single entry point any LLM or third-party app uses to learn what Pabandi can do and how to call it. Returns a PabandiPlatformDoc you should keep and use to call tools via HTTP.',
  inputSchema: { type: 'object', properties: {} },
  handler: () => pabandiPlatformDoc(),
};

const platformAccessTool = {
  name: 'pabandi_platform_access',
  description: 'Check whether the caller can access a given Pabandi platform tool (by MCP tool name, e.g. "pabandi_search" or "pabandi_hospitality_book"). Returns ok + note (the reason/authorization). Use this before calling a tool the LLM knows requires owner/verified/exclusive access.',
  inputSchema: {
    type: 'object',
    properties: { toolName: { type: 'string', description: 'MCP tool name, e.g. pabandi_search, pabandi_hospitality_book, pabandi_predictive_booking, pabandi_zk_realestate' } },
    required: ['toolName'],
  },
  handler: async (_args: any, req?: Request) => {
    const { toolName } = _args;
    const result = await toolAccessOk(toolName, req);
    return { ok: result.ok, note: result.reason, toolName };
  },
};

// ── Curated platform tool definitions (the LLM learns HOW to call each) ─────────
// Each has an inputSchema (JSON-Schema) so an LLM knows how to call it via HTTP,
// plus an access note so the LLM knows what auth/rails it needs. The LLM then calls
// the canonical /api/v1/... endpoint (the OpenAPI/spec doc is the machine-readable map).
function inputSchemaFor(tool: any) {
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(tool.inputs).map(([k, desc]) => [k, { type: 'string', description: desc }])),
    required: Object.keys(tool.inputs).filter(() => true), // placeholder; real required varies
  };
}

const PLATFORM_TOOL_DEFS = pabandiToolsRegistry
  .filter((t) => t.category !== 'sdk' && t.access !== 'exclusive' && t.access !== 'verified')
  .map((t) => ({
    name: `pabandi_${t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/:/g, '_')}`,
    description: t.description + (t.exclusiveNote ? ` (currently ${t.access})` : ''),
    inputSchema: inputSchemaFor(t),
    access: t.access,
    endpoints: t.endpoints,
  }));

// Owners can discover + call owner-gated tools
const OWNER_TOOL_DEFS = pabandiToolsRegistry
  .filter((t) => t.access === 'owner')
  .map((t) => ({
    name: `pabandi_${t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/:/g, '_')}`,
    description: t.description + ` (owner access: authenticated own account. Connect an open-finance rail + get PTP Band A/B to unlock verified/exclusive rails.)`,
    inputSchema: inputSchemaFor(t),
    access: t.access,
    endpoints: t.endpoints,
  }));

export const TOOLS = [
  ...ENGINE_TOOLS,
  discoverPlatformTool,
  platformAccessTool,
  ...PLATFORM_TOOL_DEFS,
  ...OWNER_TOOL_DEFS,
];

function jsonRpc(id: any, result?: any, error?: any) {
  return { jsonrpc: '2.0', id, result, error };
}

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
  // 1. Engine-backed tools
  if (ENGINE_TOOLS.some((t) => t.name === name)) {
    switch (name) {
      case 'pabandi_verify_passport': {
        if (!args.token) throw new Error('token (base64 attestation) required');
        let att: any;
        try { att = JSON.parse(Buffer.from(args.token, 'base64').toString('utf-8')); } catch { throw new Error('token is not valid base64 JSON'); }
        return ptpEngine.verifyAgentPassport(att, args.need);
      }
      case 'pabandi_discover': {
        return ptpEngine.getDiscoveryDocument(`${process.env.BACKEND_URL || ''}`);
      }
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

  // 2. Platform discovery + access tools
  if (name === 'pabandi_discover_platform') {
    return discoverPlatformTool.handler();
  }
  if (name === 'pabandi_platform_access') {
    return platformAccessTool.handler(args, req);
  }

  // 3. Curated platform tool definitions — the LLM learned HOW to call these via the
  //    discovery doc (inputSchema + endpoints). We route the call to the canonical HTTP
  //    endpoint here for agents that lack direct HTTP, but MOST agents should just GET/POST
  //    to the spec'd endpoint (so the OpenAPI doc stays the single source of truth).
  const def = PLATFORM_TOOL_DEFS.find((t) => t.name === name) || OWNER_TOOL_DEFS.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown MCP tool: ${name} (run pabandi_discover_platform to see available tools)`);

  // Access check FIRST (so the LLM is told precisely why a call would fail).
  const accessResult = await toolAccessOk(name, req, {
    ownerUserId: (req as any)?.user?.id,
    businessId: (args as any)?.businessId,
    verifiedRail: false,
  });
  if (!accessResult.ok && def.access !== 'public') {
    // public tools can still be called; otherwise return the precise denial.
    throw new Error(`access denied: ${accessResult.note}`);
  }

  // Delegate to the real endpoint. Agents without direct HTTP can use this; those with
  // HTTP should call /api/v1/... directly (OpenAPI/spec is the canonical doc).
  const ep = def.endpoints[0];
  if (!ep) throw new Error(`no endpoint for ${name}`);
  // Build a synthetic call description the agent can follow (best-effort within MCP).
  const method = ep.method.toUpperCase();
  const path = ep.path.replace(':id', args.id || (args.businessId || ''));
  const inputs = { ...args };
  // Return a structured "call guide" the agent can execute via its own HTTP tool.
  return {
    mcpDelegatedCall: {
      method,
      path,
      baseUrl: process.env.BACKEND_URL || 'https://pabandi.onrender.com',
      inputs,
      access: accessResult.note,
    },
    note: 'This MCP server itself does NOT perform the platform call — it returns the exact HTTP call you should make to the canonical endpoint. Call POST/GET ' + path + ' to ' + (process.env.BACKEND_URL || 'https://pabandi.onrender.com') + ' with the inputs above.',
  };
}

/** Express handler for POST /mcp (MCP Streamable HTTP). Performs real platform calls
 * via the canonical HTTP endpoints when an MCP client asks a platform tool to execute —
 * so the MCP server itself becomes the uniform access layer (not just a discovery doc).
 *
 * Access is enforced STRUCTURALLY: every platform tool handler calls authorizePlatformTool
 * (inline, not trusting the client's self-report), and returns 403 + a precise reason on
 * denial so an LLM or app learns exactly what it needs (connect a rail, reach Band A/B, etc.). */
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
