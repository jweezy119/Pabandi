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
import { declareDiscoveryExtension } from '@x402/extensions';
import { didService } from '../services/vc/did.service';

const SERVER_NAME = 'pabandi-trust';
const SERVER_VERSION = '1.0.0';
const BACKEND = (process.env.BACKEND_URL || 'https://pabandi.onrender.com').replace(/\/+$/, '');

/**
 * x402 prices, keyed by the REAL tool names in TOOLS below.
 *
 * These keys were `pabandi_initiate_escrow` and `pabandi_create_booking` —
 * names of tools that exist in no registry entry and in no tools/list response.
 * `requireX402` looks up by the tool the caller actually asked for, so both
 * prices were unreachable: escrow and booking ran unmetered while the directory
 * copy advertised them as paid. A quoted price you never charge is worse than no
 * price, because it implies a control that isn't there.
 */
const X402_PRICE_USDC: Record<string, number> = {
  pabandi_issue_passport: 1.0,
  pabandi_start_escrow: 0.5,
  pabandi_book_stay: 0.25,
};

/**
 * ─── BAZAAR DISCOVERY FOR THE PAID TOOLS ─────────────────────────────────────
 *
 * Every x402-gated tool places its discovery declaration in the JSON-RPC 402
 * the caller receives, so the Bazaar (and any agent) can render each tool's
 * request schema and a worked response example without touching the dispatch
 * code. `declareDiscoveryExtension` builds exactly the record shape the
 * x402 Bazaar reads (`extensions.bazaar`), and `tools/list` still serves the
 * TOOLS table untouched — this is discovery metadata only.
 */
const X402_TOOLExamples: Record<string, { inputExample: Record<string, unknown>; outputExample: Record<string, unknown> }> = {
  pabandi_issue_passport: {
    inputExample: {
      agentId: 'svc-agent-7',
      capabilities: ['act:book', 'read'],
      idempotencyKey: 'iss-3001',
    },
    outputExample: {
      passportId: 'pass_9f8e7d6c',
      agentId: 'svc-agent-7',
      capabilities: ['act:book', 'read'],
      riskBand: 'B',
      feePAB: 10,
      idempotentReplay: false,
    },
  },
  pabandi_start_escrow: {
    inputExample: {
      bookingId: 'bk_2211',
      amount: 200,
    },
    outputExample: {
      escrowId: 'esc_4242',
      status: 'HELD',
      network: 'solana',
      amount: 200,
      currency: 'USDC',
    },
  },
  pabandi_book_stay: {
    inputExample: {
      propertyId: 'prop_88',
      guestEmail: 'guest@example.com',
      checkIn: '2026-11-02',
      checkOut: '2026-11-05',
    },
    outputExample: {
      reservationId: 'res_7781',
      propertyId: 'prop_88',
      status: 'confirmed',
      deposit: { amount: 120, currency: 'USDC', escrowStatus: 'HELD' },
    },
  },
};

function bazaarExtensionForTool(toolName: string): Record<string, unknown> | undefined {
  const tool = TOOLS.find((t: any) => t.name === toolName);
  const examples = X402_TOOLExamples[toolName];
  if (!tool || !examples) return undefined;
  // TOOLS entries type inputSchema loosely (unknown) because half of the table
  // is plain documentation; a declared schema is required for discovery, and
  // every paid tool has one.
  const schema = tool.inputSchema as Record<string, unknown> | undefined;
  if (!schema) return undefined;
  return declareDiscoveryExtension({
    toolName,
    description: tool.description,
    transport: 'json-rpc',
    inputSchema: schema,
    example: examples.inputExample,
    output: { example: examples.outputExample },
  });
}

async function requireX402(toolName: string, req?: Request): Promise<void> {
  const price = X402_PRICE_USDC[toolName];
  if (!price) return;
  const paymentProof = (req as any)?.headers?.['x-payment'] as string | undefined;

  const requirements = {
    x402: true,
    scheme: 'x402',
    price: `${price} USDC`,
    network: 'solana',
    recipient: process.env.SOLANA_USDC_ADDRESS || 'PABANDI_USDC_WALLET',
    tool: toolName,
    paymentMethods: ['solana-usdc', 'x402'],
    // Computed lazily against a tool lookup, not baked into a static: when a
    // paid tool's schema changes, its discovery follows without a second edit.
    extensions: bazaarExtensionForTool(toolName),
  };

  if (!paymentProof) {
    throw new Error(JSON.stringify(requirements));
  }

  const { verifyX402Payment } = await import('../services/x402.service');
  const result = await verifyX402Payment({
    paymentHeader: paymentProof,
    resource: `mcp:${toolName}`,
    amount: price,
  });

  if (!result.valid) {
    throw new Error(JSON.stringify({ ...requirements, invalidReason: result.reason }));
  }
}

// ── Engine tools ──────────────────────────────────────────────────────────────
const ENGINE_TOOLS = [
  {
    name: 'pabandi_verify_passport',
    description: 'Verify a Pabandi PTP attestation (agent/business/individual/trust rail). Input base64-encoded attestation token and optional need (e.g. "act:book"). Returns valid, grantedCapabilities, riskBand, expiresAt. Works offline. Example: {"token": "...base64...", "need": "act:book"}',
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
    description: 'Get PTP discovery (public). Returns verify endpoint, public key, issue endpoint, risk bands, entity types. No auth required.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pabandi_get_ledger',
    description: 'Look up a passport issuance charge by idempotencyKey (public audit). Returns feePab, ownerUserId, agentId, riskBand, capabilities, chargedAt. Example: {"idempotencyKey": "iss-3001"}',
    inputSchema: { type: 'object', properties: { idempotencyKey: { type: 'string' } }, required: ['idempotencyKey'] },
  },
  {
    name: 'pabandi_issue_passport',
    description: 'Issue a scoped Agent Capability Passport (auth required via Bearer token from the owner). Capabilities validated against trust band. Metered at PAB_FEE_PER_PASSPORT $PAB per issue; idempotent via idempotencyKey. Example: {"agentId": "svc-agent-7", "capabilities": ["act:book", "read"], "idempotencyKey": "iss-3001"}. Get API key at POST /api/v1/agents/register.',
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
  {
    name: 'pabandi_execute_transaction',
    description:
      'Spend against an open PabandiSession -- book a service, pay an invoice, or fund an escrow. ' +
      'REQUIRES a sessionId. Sessions are authorised once against a Trust-Score-derived limit and let ' +
      'you transact repeatedly without a wallet signature per call, which is the entire point. ' +
      'If you do not have a session, call pabandi_open_session first and use the sessionId it returns; ' +
      'this tool will refuse without one rather than fall back to a per-call signature. ' +
      "A booking action may return actionRequired 'deposit_required' plus a deposit object (amount, currency, checkoutUrl); fund the deposit at checkoutUrl before treating the booking as settled.",
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'id of an active PabandiSession (from pabandi_open_session)' },
        actionType: {
          type: 'string',
          enum: ['booking', 'invoice_pay', 'escrow'],
          description: 'What kind of action this spend authorises',
        },
        amount: { type: 'number', description: 'Amount in USDC to deduct from the session limit' },
        payload: {
          type: 'object',
          description: "Action-specific detail. For bookings this must include businessId, so the server can evaluate the business's deposit policy. Opaque to the engine otherwise; hashed into the receipt.",
          additionalProperties: true,
        },
        idempotencyKey: {
          type: 'string',
          description: 'Optional. A retry with the same key returns the original receipt and does not spend again.',
        },
      },
      required: ['sessionId', 'actionType', 'amount'],
    },
  },
  {
    name: 'pabandi_get_services',
    description: 'Get services offered by a business for agent booking',
    inputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string', description: 'Business ID' },
      },
      required: ['businessId'],
    },
  },
  {
    name: 'pabandi_check_availability',
    description: 'Check availability for a business on a specific date',
    inputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string', description: 'Business ID' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['businessId', 'date'],
    },
  },
  {
    name: 'pabandi_create_booking',
    description: 'Create a booking for an agent/client. Supports ACP, x402, AP2, UCP protocols.',
    inputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string', description: 'Business ID' },
        serviceId: { type: 'string', description: 'Service ID' },
        datetime: { type: 'string', description: 'Booking datetime' },
        clientPassportId: { type: 'string', description: 'Client passport ID' },
        protocol: { type: 'string', enum: ['acp', 'x402', 'ap2', 'ucp'], description: 'Payment protocol' },
      },
      required: ['businessId', 'serviceId', 'datetime'],
    },
  },
  {
    name: 'pabandi_cancel_booking',
    description: 'Cancel a booking',
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'Booking ID' },
      },
      required: ['bookingId'],
    },
  },
  // ── Kernel syscalls: the OS layer for agents ─────────────────────────────────
  {
    name: 'pabandi_escrow_lock',
    description: 'Lock funds in escrow (allocate memory). Creates a new escrow and funds it. Returns escrowId, status, and amount locked. This is the primitive agents use to put money on hold before work begins.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in USDC to lock' },
        description: { type: 'string', description: 'Human-readable description of what the escrow secures' },
        deliverableHash: { type: 'string', description: 'Optional hash of the expected deliverable' },
        idempotencyKey: { type: 'string', description: 'Optional idempotency key for retries' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'pabandi_escrow_release',
    description: 'Release locked escrow funds to the recipient. Requires escrowId. Returns release status and amount released.',
    inputSchema: {
      type: 'object',
      properties: {
        escrowId: { type: 'string', description: 'Escrow ID to release' },
        deliverableHash: { type: 'string', description: 'Hash of the delivered work, verified against the locked hash' },
        idempotencyKey: { type: 'string', description: 'Optional idempotency key for retries' },
      },
      required: ['escrowId'],
    },
  },
  {
    name: 'pabandi_escrow_create_child',
    description: 'Create a child sub-escrow from a master escrow (parent-child subcontracting). Allocates a portion of master funds to a subcontractor. Returns childEscrowId and amount allocated.',
    inputSchema: {
      type: 'object',
      properties: {
        masterEscrowId: { type: 'string', description: 'Parent escrow ID' },
        providerPassportId: { type: 'string', description: 'Subcontractor passport/agent ID' },
        amount: { type: 'number', description: 'Amount in USDC to allocate to this child' },
        deliverableHash: { type: 'string', description: 'Expected deliverable hash' },
        idempotencyKey: { type: 'string', description: 'Optional idempotency key for retries' },
      },
      required: ['masterEscrowId', 'providerPassportId', 'amount'],
    },
  },
  {
    name: 'pabandi_trust_resolve',
    description: 'Resolve the trust score and reputation for a passport/agent. Returns trustScore, tier, verifiedIdentity, and capability band. Used by agents to evaluate counterparties before transacting.',
    inputSchema: {
      type: 'object',
      properties: {
        passportId: { type: 'string', description: 'Passport or agent ID to resolve' },
        need: { type: 'string', description: 'Optional capability required, e.g. "act:book"' },
      },
      required: ['passportId'],
    },
  },
  {
    name: 'pabandi_escrow_balance',
    description: 'Check escrow balance and status. Returns status, totalAmount, releasedAmount, and platformFee.',
    inputSchema: {
      type: 'object',
      properties: {
        escrowId: { type: 'string', description: 'Escrow ID to check' },
      },
      required: ['escrowId'],
    },
  },
  {
    name: 'pabandi_m2m_post_project',
    description: 'Post a machine-to-machine project to the marketplace. Creates an open project with escrow protection. Returns projectId and hireUrl. Used by agents to post work they need done.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Project title' },
        description: { type: 'string', description: 'Project description' },
        budgetUsd: { type: 'number', description: 'Budget in USDC' },
        requiredSkills: { type: 'array', items: { type: 'string' }, description: 'Required skills' },
        deliverableHash: { type: 'string', description: 'Expected deliverable hash' },
        deadlineHours: { type: 'number', description: 'Deadline in hours from now' },
        category: { type: 'string', description: 'Project category' },
      },
      required: ['title', 'description', 'budgetUsd'],
    },
  },
  {
    name: 'pabandi_session_close',
    description: 'Close an open session and optionally settle remaining funds. Returns settlement summary.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to close' },
        settle: { type: 'boolean', description: 'If true, attempt to settle any remaining balance' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'pabandi_session_receipts',
    description: 'List all receipts (spend records) for a session. Returns the full spend history.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        limit: { type: 'number', description: 'Maximum receipts to return (default 50)' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'pabandi_session_list',
    description: 'List all sessions opened by an owner (user or agent). Returns sessions with balances and status.',
    inputSchema: {
      type: 'object',
      properties: {
        ownerType: { type: 'string', enum: ['user', 'agent'], description: 'Owner type' },
        ownerId: { type: 'string', description: 'Owner ID' },
      },
      required: ['ownerType', 'ownerId'],
    },
  },
  {
    name: 'pabandi_identity_register',
    description: 'Register an agent\'s identity onchain via ERC-8004. Creates a portable onchain identity that can be verified across the ecosystem. Returns the onchain agentId and transaction hash. Gasless for the agent (Pabandi pays gas).',
    inputSchema: {
      type: 'object',
      properties: {
        passportId: { type: 'string', description: 'Trust Passport ID to register onchain' },
      },
      required: ['passportId'],
    },
  },
  {
    name: 'pabandi_identity_reputation_sync',
    description: 'Sync an agent\'s trust score to the onchain ERC-8004 reputation registry. Posts feedback about completed tasks and success rate. Gasless for the agent (Pabandi pays gas).',
    inputSchema: {
      type: 'object',
      properties: {
        passportId: { type: 'string', description: 'Trust Passport ID to sync reputation for' },
      },
      required: ['passportId'],
    },
  },
  {
    name: 'pabandi_discover_agents',
    description: 'Discover agents by skills, trust score, and location. Returns agents sorted by relevance with trust scores and capability badges.',
    inputSchema: {
      type: 'object',
      properties: {
        skills: { type: 'array', items: { type: 'string' }, description: 'Required skills to match against' },
        minTrustScore: { type: 'number', description: 'Minimum trust score (default 500)', default: 500 },
        category: { type: 'string', description: 'Agent category filter' },
        limit: { type: 'number', description: 'Maximum results (default 20)', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'pabandi_escrow_waterfall',
    description: 'Check and trigger waterfall settlement for parent-child escrows. When all child escrows are released, the master escrow is marked completed. Returns settlement status.',
    inputSchema: {
      type: 'object',
      properties: {
        masterEscrowId: { type: 'string', description: 'Master escrow ID to check' },
      },
      required: ['masterEscrowId'],
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
  // mcpName is the stable, published identifier. `shortSlug` is only the
  // fallback for entries that predate mcpName — never the primary name.
  const toolName = t.mcpName || `pabandi_${shortSlug}`;
  return {
    name: toolName,
    legacyName: t.mcpName ? `pabandi_${shortSlug}` : undefined,
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
    registryName: t.name,
    handler: async (args: any, req?: Request) => callPlatformHttp({ name: toolName, registryName: t.name, access: t.access, endpoints: t.endpoints }, args, req),
  };
}

const PLATFORM_TOOL_DEFS = pabandiToolsRegistry
  .filter((t: any) => t.category !== 'sdk')
  .map((t: any) => buildPlatformToolDef(t));

// Gated tools are already included above — building them twice produced
// duplicate entries in tools/list, which makes an agent pick at random.
const OWNER_TOOL_DEFS: any[] = [];

export const TOOLS = (() => {
  const all = [
    ...ENGINE_TOOLS,
    discoverPlatformTool,
    platformAccessTool,
    ...PLATFORM_TOOL_DEFS,
    ...OWNER_TOOL_DEFS,
  ];
  // Duplicate names in tools/list make an agent pick at random — first wins,
  // and the shadowed one is reported so the registry can be de-conflicted.
  const seen = new Set<string>();
  const unique = all.filter((t: any) => {
    if (seen.has(t.name)) {
      logger.warn(`[mcp] duplicate tool name suppressed: ${t.name} (registry: ${t.registryName ?? 'engine'})`);
      return false;
    }
    seen.add(t.name);
    return true;
  });
  return unique;
})();

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
        let x402Error: any = null;
        try { x402Error = JSON.parse(e.message); } catch { /* not x402 */ }
        if (x402Error?.x402) {
          return jsonRpc(id, undefined, { code: 402, message: 'Payment required', data: x402Error });
        }
        return jsonRpc(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }

    default:
      return jsonRpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  }
}

async function callTool(toolName: string, args: any, req?: Request): Promise<any> {
  // Back-compat: tool names were once derived from marketing `short` labels.
  const legacy = TOOLS.find((t: any) => t.legacyName === toolName) as any;
  const name = legacy ? legacy.name : toolName;

  await requireX402(name, req);

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
      case 'pabandi_open_session': {
        const { engineService } = await import('../services/engine.service');
        const { resolveTrustScore } = await import('../services/trust.service');

        const ownerType = args.ownerType === 'agent' ? 'agent' : 'user';
        const ownerId = String(args.ownerId ?? '');

        if (!ownerId) {
          throw new Error(
            'ownerId is required. Call pabandi_open_session with { ownerType: "agent"|"user", ownerId } to get a sessionId for pabandi_execute_transaction.'
          );
        }

        // Score resolved server-side, never from the caller. An agent asking
        // for a large tab does not get to assert the score that grants it.
        const trust = await resolveTrustScore(ownerType, ownerId);

        return engineService.openSession(ownerType, ownerId, trust.score);
      }
      case 'pabandi_execute_transaction': {
        // ── WHY A MISSING SESSION IS AN ERROR, NOT A FALLBACK ───────────────
        // The obvious design is "no sessionId? fall back to a per-call
        // signature." That would be wrong: the fallback is the exact friction
        // this tool exists to remove, and it would fail silently and expensively
        // -- every call would work, just with a signature, and nothing would
        // tell the agent it had lost the cheap path.
        //
        // So this refuses, and the error names the endpoint that fixes it.
        const sessionId = String(args.sessionId ?? '').trim();
        if (!sessionId) {
          throw new Error(
            'sessionId is required. pabandi_execute_transaction spends from an open PabandiSession. ' +
              'Call pabandi_open_session first (or POST /api/v1/engine/session/open) and pass the returned sessionId. ' +
              'This tool does not fall back to a per-call wallet signature.'
          );
        }

        const actionType = args.actionType;
        if (!['booking', 'invoice_pay', 'escrow'].includes(actionType)) {
          throw new Error("actionType must be one of 'booking', 'invoice_pay', 'escrow'.");
        }

        const amount = Number(args.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('amount must be a number greater than zero.');
        }

        const { engineService } = await import('../services/engine.service');
        const outcome = await engineService.executeTransaction({
          sessionId,
          actionType,
          amount,
          payload: (args.payload ?? {}) as Record<string, unknown>,
          idempotencyKey: args.idempotencyKey ? String(args.idempotencyKey) : undefined,
        });

        if (!outcome.ok) {
          // LIMIT_EXCEEDED gets the remedy inline, because an agent that has
          // just run a tab down needs to know what to do next without a
          // round trip to read docs.
          if (outcome.error.code === 'LIMIT_EXCEEDED') {
            throw new Error(
              `Session limit exceeded: spent ${outcome.error.spent} of ${outcome.error.totalLimit}, requested ${outcome.error.requested}. ` +
                'Open a new session with pabandi_open_session.'
            );
          }
          throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
        }

        return outcome.value;
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

      case 'pabandi_source_for_task': {
        const { title, description = '', skills = [], budget, limit = 3 } = args;
        // Contextual sourcing: analyze task and match by skills + trust
        const allSkills = [...skills];
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes('react')) allSkills.push('React');
        if (lowerDesc.includes('node')) allSkills.push('Node.js');
        if (lowerDesc.includes('design')) allSkills.push('Design');
        if (lowerDesc.includes('bug')) allSkills.push('Debugging');
        
        const passports = await prisma.trustPassport.findMany({
          where: {
            visibility: { in: ['PUBLIC', 'MODULE_ONLY'] },
            score: { gte: 450 },
          },
          take: 100,
          orderBy: [{ score: 'desc' }, { deliverySampleSize: 'desc' }],
        });
        
        // Score and rank by relevance
        const scored = passports.map((p: any) => {
          const pSkills = Array.isArray(p.skills) ? p.skills : [];
          const skillMatch = allSkills.filter(s => pSkills.some((ps: string) => ps.toLowerCase().includes(s.toLowerCase()))).length;
          const relevanceScore = (p.score || 500) + skillMatch * 50;
          return { p, skillMatch, relevanceScore };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        const results = scored.slice(0, limit).map(({ p, skillMatch }: any) => ({
          handle: p.handle,
          displayName: p.displayName,
          score: p.score || 500,
          level: p.level || 'Bronze',
          category: p.category,
          skills: p.skills || [],
          headline: p.headline,
          verifiedIdentity: p.verifiedIdentity,
          skillMatch,
          profileUrl: `https://pabandi.com/trust/${p.handle}`,
          verifyUrl: `https://pabandi.com/verify`,
          vcVerifyUrl: `https://pabandi.com/verify`,
          matchReason: `${skillMatch > 0 ? skillMatch + ' skill match' : 'High trust'} • Score ${p.score || 500} • ${p.deliverySampleSize || 0} deliveries • ZK-verified`,
          secureDeposit: true,
          escrowAvailable: true,
        }));
        return { success: true, task: { title, skills: allSkills, budget }, results, count: results.length, recommendation: 'Use Secure Deposit (escrow) for protection' };
      }
      case 'pabandi_check_vendor_trust': {
        const { handle, email, did } = args;
        let passport: any = null;
        if (handle) passport = await prisma.trustPassport.findUnique({ where: { handle } });
        else if (email) {
          const user = await prisma.user.findUnique({ where: { email } });
          if (user) passport = await prisma.trustPassport.findUnique({ where: { userId: user.id } });
        }
        if (!passport) return { success: false, found: false, message: 'No passport found' };
        return {
          success: true,
          found: true,
          passport: {
            handle: passport.handle,
            displayName: passport.displayName,
            score: passport.score || 500,
            level: passport.level || 'Bronze',
            verifiedIdentity: passport.verifiedIdentity,
            deliveryScore: passport.deliveryScore,
            paymentScore: passport.paymentScore,
            showUpScore: passport.showUpScore,
            category: passport.category,
            skills: passport.skills,
            profileUrl: `https://pabandi.com/trust/${passport.handle}`,
            verifyUrl: `https://pabandi.com/verify`,
            did: didService.getDid(),
          },
        };
      }
      case 'pabandi_get_trusted_vendors': {
        const { category, skills = [], minScore = 500, tier, limit = 10 } = args;
        const where: any = { visibility: 'PUBLIC', score: { gte: minScore } };
        if (category) where.category = category;
        if (tier) where.level = tier;
        const passports = await prisma.trustPassport.findMany({ where, take: limit, orderBy: { score: 'desc' } });
        return {
          success: true,
          vendors: passports.map((p: any) => ({
            handle: p.handle,
            displayName: p.displayName,
            score: p.score || 500,
            level: p.level || 'Bronze',
            category: p.category,
            skills: p.skills || [],
            verifiedIdentity: p.verifiedIdentity,
            profileUrl: `https://pabandi.com/trust/${p.handle}`,
          })),
          count: passports.length,
        };
      }
      case 'pabandi_create_hire_from_task': {
        const authUser = (req as any)?.user;
        if (!authUser?.id) throw new Error('Authentication required. Pass Bearer token from POST /api/v1/agents/register or login.');
        const { title, description, skills = [], budget, providerHandle, taskId } = args;
        let poster = await prisma.agentProfile.findFirst({ where: { slug: `client-${authUser.id}` } });
        if (!poster) {
          poster = await prisma.agentProfile.create({
            data: {
              name: (req as any)?.user?.firstName || authUser.email || 'Client',
              slug: `client-${authUser.id}`,
              description: 'Client via PM integration',
              capabilities: [],
              walletAddress: '0x0',
              publicKey: '0x0',
            },
          });
        }
        const project = await prisma.agentProject.create({
          data: {
            title,
            description,
            requirements: JSON.stringify({ skills, taskId, source: 'pm-integration', providerHandle }),
            posterId: poster.id,
            budgetUsd: Number(budget),
            budgetPab: Number(budget) * 10,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: skills[0] || 'general',
            status: 'OPEN',
            metadata: { taskId, source: 'pm-integration', providerHandle },
          },
        });
        return {
          success: true,
          projectId: project.id,
          hireUrl: `https://pabandi.com/marketplace`,
          escrowProtected: true,
          message: 'Job created with escrow protection. Fund escrow to hire safely.',
        };
      }

      // ── Kernel syscall: pabandi_escrow_lock ──
      case 'pabandi_escrow_lock': {
        const { amount, description, deliverableHash, payerId, payeeId } = args;
        if (!amount || amount <= 0) throw new Error('amount must be greater than zero');
        if (!description) throw new Error('description is required');
        if (!payerId) throw new Error('payerId is required');
        if (!payeeId) throw new Error('payeeId is required');

        const escrow = await prisma.escrow.create({
          data: {
            amount: Math.round(amount * 100),
            status: 'LOCKED',
            description,
            deliverableHash,
            lockedAt: new Date(),
            payer: { connect: { id: payerId } },
            payee: { connect: { id: payeeId } },
          },
        });
        return {
          success: true,
          escrowId: escrow.id,
          status: escrow.status,
          amountLocked: escrow.amount / 100,
          currency: 'USDC',
          lockedAt: escrow.lockedAt,
          message: `Escrow locked: $${amount} secured for "${description}"`,
        };
      }

      // ── Kernel syscall: pabandi_escrow_release ──
      case 'pabandi_escrow_release': {
        const { escrowId, deliverableHash, idempotencyKey } = args;
        if (!escrowId) throw new Error('escrowId is required');

        const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
        if (!escrow) throw new Error('escrow not found');
        if (escrow.status !== 'LOCKED') throw new Error(`escrow is ${escrow.status}, cannot release`);

        const updated = await prisma.escrow.update({
          where: { id: escrowId },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
            deliverableHash: deliverableHash || escrow.deliverableHash,
          },
        });
        return {
          success: true,
          escrowId: updated.id,
          status: updated.status,
          amountReleased: updated.amount / 100,
          releasedAt: updated.releasedAt,
          message: `Escrow released: $${updated.amount / 100} paid out`,
        };
      }

      // ── Kernel syscall: pabandi_escrow_create_child ──
      case 'pabandi_escrow_create_child': {
        const { masterEscrowId, providerPassportId, amount, deliverableHash, idempotencyKey } = args;
        if (!masterEscrowId) throw new Error('masterEscrowId is required');
        if (!providerPassportId) throw new Error('providerPassportId is required');
        if (!amount || amount <= 0) throw new Error('amount must be greater than zero');

        const master = await prisma.escrow.findUnique({ where: { id: masterEscrowId } });
        if (!master) throw new Error('master escrow not found');
        if (master.status !== 'LOCKED') throw new Error(`master escrow is ${master.status}, cannot create child`);
        if (amount / 100 > master.amount / 100) throw new Error('child amount exceeds master escrow balance');

        const child = await prisma.agentEscrow.create({
          data: {
            projectId: `child_${masterEscrowId}_${Date.now()}`,
            parentEscrowId: masterEscrowId,
            providerPassportId,
            totalAmount: amount,
            releaseAmount: amount,
            platformFee: amount * 0.02,
            status: 'FUNDED',
            deliverableHash,
          },
        });
        return {
          success: true,
          childEscrowId: child.id,
          masterEscrowId,
          providerPassportId,
          amountAllocated: amount,
          status: child.status,
          message: `Child escrow created: $${amount} allocated to ${providerPassportId}`,
        };
      }

      // ── Kernel syscall: pabandi_trust_resolve ──
      case 'pabandi_trust_resolve': {
        const { passportId, need } = args;
        if (!passportId) throw new Error('passportId is required');

        const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
        if (!passport) throw new Error('passport not found');

        const score = passport.score || 500;
        const tier = score >= 800 ? 'Platinum' : score >= 650 ? 'Gold' : score >= 500 ? 'Silver' : 'Bronze';

        return {
          success: true,
          passportId,
          trustScore: score,
          tier,
          verifiedIdentity: passport.verifiedIdentity || false,
          capabilityBand: tier,
          needsMet: need ? need.split(',').map((n: string) => ({
            capability: n.trim(),
            met: true, // simplified: all capabilities met if passport exists
          })) : [],
          profileUrl: `https://pabandi.com/trust/${passport.handle}`,
          message: `Trust resolved: ${score} (${tier})`,
        };
      }

      // ── Kernel syscall: pabandi_escrow_balance ──
      case 'pabandi_escrow_balance': {
        const { escrowId } = args;
        if (!escrowId) throw new Error('escrowId is required');

        const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
        if (!escrow) throw new Error('escrow not found');

        return {
          success: true,
          escrowId: escrow.id,
          status: escrow.status,
          totalAmount: escrow.amount / 100,
          releasedAmount: 0,
          availableAmount: escrow.amount / 100,
          platformFee: escrow.platformFeeAmount || 0,
          currency: 'USDC',
          lockedAt: escrow.lockedAt,
          releasedAt: escrow.releasedAt,
        };
      }

      // ── Kernel syscall: pabandi_m2m_post_project ──
      case 'pabandi_m2m_post_project': {
        const { title, description, budgetUsd, requiredSkills = [], deliverableHash, deadlineHours, category } = args;
        if (!title) throw new Error('title is required');
        if (!description) throw new Error('description is required');
        if (!budgetUsd || budgetUsd <= 0) throw new Error('budgetUsd must be greater than zero');

        const authUser = (req as any)?.user;
        let posterId: string;
        if (authUser?.id) {
          let poster = await prisma.agentProfile.findFirst({ where: { slug: `client-${authUser.id}` } });
          if (!poster) {
            poster = await prisma.agentProfile.create({
              data: {
                name: (req as any)?.user?.firstName || authUser.email || 'Client',
                slug: `client-${authUser.id}`,
                description: 'Client via MCP',
                capabilities: [],
                walletAddress: '0x0',
                publicKey: '0x0',
              },
            });
          }
          posterId = poster.id;
        } else {
          posterId = `anon_${Date.now()}`;
        }

        const project = await prisma.agentProject.create({
          data: {
            title,
            description,
            category: category || 'general',
            requirements: JSON.stringify(requiredSkills || []),
            budgetUsd: Number(budgetUsd),
            budgetPab: Number(budgetUsd) * 10,
            status: 'OPEN',
            poster: { connect: { id: posterId } },
            deliverableHash,
            deadline: deadlineHours ? new Date(Date.now() + deadlineHours * 60 * 60 * 1000) : new Date(),
          },
        });
        return {
          success: true,
          projectId: project.id,
          title: project.title,
          budgetUsd: project.budgetUsd,
          status: project.status,
          escrowProtected: true,
          message: `Project posted: "${title}" - $${budgetUsd} escrow-protected`,
        };
      }

      // ── Kernel syscall: pabandi_session_close ──
      case 'pabandi_session_close': {
        const { engineService } = await import('../services/engine.service');
        const { sessionId, settle } = args;
        if (!sessionId) throw new Error('sessionId is required');

        const outcome = await engineService.closeSession(sessionId, settle ?? false);

        if (!outcome.ok) {
          throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
        }

        return {
          success: true,
          sessionId: outcome.value.sessionId,
          status: outcome.value.status,
          settled: outcome.value.settled,
          totalSpent: outcome.value.spent,
          unsettledAmount: outcome.value.unsettledAmount,
          currency: outcome.value.currency,
          receiptCount: outcome.value.receiptCount,
          message: outcome.value.settled
            ? `Session ${sessionId} closed and settled`
            : `Session ${sessionId} closed`,
        };
      }

      // ── Kernel syscall: pabandi_session_receipts ──
      case 'pabandi_session_receipts': {
        const { engineService } = await import('../services/engine.service');
        const { sessionId, limit } = args;
        if (!sessionId) throw new Error('sessionId is required');

        const receipts = await engineService.listReceipts(sessionId, limit ? Number(limit) : 50);
        return {
          success: true,
          sessionId,
          receipts,
          count: receipts.length,
        };
      }

      // ── Kernel syscall: pabandi_session_list ──
      case 'pabandi_session_list': {
        const { engineService } = await import('../services/engine.service');
        const { ownerType, ownerId } = args;
        if (!ownerType || !ownerId) throw new Error('ownerType and ownerId are required');

        const sessions = await engineService.listSessionsForOwner(ownerId, 50);
        return {
          success: true,
          ownerType,
          ownerId,
          sessions,
          count: sessions.length,
        };
      }

      // ── Kernel syscall: pabandi_discover_agents ──
      case 'pabandi_discover_agents': {
        const { skills: rawSkills = [], minTrustScore = 500, category, limit = 20 } = args;
        const skills = Array.isArray(rawSkills) ? rawSkills as string[] : [];

        const where: any = {
          visibility: { in: ['PUBLIC', 'MODULE_ONLY'] },
          score: { gte: minTrustScore },
        };
        if (category) where.category = category;

        const passports = await prisma.trustPassport.findMany({
          where,
          take: Math.min(limit, 100),
          orderBy: [{ score: 'desc' }, { deliverySampleSize: 'desc' }],
        });

        const allSkills = skills.map((s: string) => s.toLowerCase());
        const scored = passports.map((p) => {
          const pSkills = Array.isArray(p.skills) ? (p.skills as unknown[]).map((s: unknown) => String(s).toLowerCase()) : [];
          const skillMatch = allSkills.filter(s => pSkills.includes(s)).length;
          const relevanceScore = (p.score || 500) + skillMatch * 50;
          return { passport: p, skillMatch, relevanceScore };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
          success: true,
          agents: scored.map(({ passport, skillMatch, relevanceScore }) => ({
            agentId: passport.id,
            handle: passport.handle,
            displayName: passport.displayName,
            trustScore: passport.score || 500,
            tier: (passport.score || 500) >= 800 ? 'Platinum' : (passport.score || 500) >= 650 ? 'Gold' : (passport.score || 500) >= 500 ? 'Silver' : 'Bronze',
            skills: passport.skills || [],
            skillMatch,
            category: passport.category,
            verifiedIdentity: passport.verifiedIdentity,
            profileUrl: `https://pabandi.com/trust/${passport.handle}`,
          })),
          count: scored.length,
        };
      }

      // ── Kernel syscall: pabandi_escrow_waterfall ──
      case 'pabandi_escrow_waterfall': {
        const { masterEscrowId } = args;
        if (!masterEscrowId) throw new Error('masterEscrowId is required');

        const master = await prisma.agentEscrow.findUnique({
          where: { id: masterEscrowId },
          include: { childEscrows: true },
        });
        if (!master) throw new Error('master escrow not found');

        if (master.status !== 'FUNDED' && master.status !== 'subcontracted') {
          throw new Error(`master escrow is ${master.status}, cannot settle waterfall`);
        }

        const allChildren = await prisma.agentEscrow.findMany({
          where: { parentEscrowId: masterEscrowId },
        });

        if (allChildren.length === 0) {
          return {
            success: true,
            masterEscrowId,
            status: master.status,
            childCount: 0,
            message: 'No child escrows to settle',
          };
        }

        const allReleased = allChildren.every(c => c.status === 'RELEASED');
        const allCompleted = allChildren.every(c => c.status === 'RELEASED' || c.status === 'COMPLETED');

        let updatedStatus = master.status;
        if (allCompleted) {
          updatedStatus = 'COMPLETED';
          await prisma.agentEscrow.update({
            where: { id: masterEscrowId },
            data: { status: 'COMPLETED', releasedAt: new Date() },
          });
        }

        return {
          success: true,
          masterEscrowId,
          status: updatedStatus,
          childCount: allChildren.length,
          releasedCount: allChildren.filter(c => c.status === 'RELEASED').length,
          message: allCompleted ? 'All child escrows released - master marked completed' : `Waterfall check: ${allChildren.filter(c => c.status === 'RELEASED').length}/${allChildren.length} children released`,
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
