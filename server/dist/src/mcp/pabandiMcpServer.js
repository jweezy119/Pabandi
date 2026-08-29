"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpHandler = exports.TOOLS = void 0;
const ptp_spec_1 = require("../protocol/ptp.spec");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const passportEconomy_service_1 = require("../services/passportEconomy.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const pabandiTools_service_1 = require("../services/pabandiTools.service");
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
    handler: () => (0, pabandiTools_service_1.pabandiPlatformDoc)(),
};
const platformAccessTool = {
    name: 'pabandi_platform_access',
    description: 'Check whether the caller can access a given Pabandi platform tool (by MCP tool name). Returns ok + note.',
    inputSchema: {
        type: 'object',
        properties: { toolName: { type: 'string', description: 'MCP tool name, e.g. pabandi_search' } },
        required: ['toolName'],
    },
    handler: async (_args, req) => {
        const { toolName } = _args;
        const result = await (0, pabandiTools_service_1.toolAccessOk)(toolName, req);
        return { ok: result.ok, note: result.reason, toolName };
    },
};
function jsonRpc(id, result, error) {
    return { jsonrpc: '2.0', id, result, error };
}
// ── Real HTTP proxy ───────────────────────────────────────────────────────────
async function callPlatformHttp(def, args, req) {
    const ep = def.endpoints[0];
    if (!ep)
        throw new Error(`no endpoint mapped for ${def.name}`);
    // 1) enforce structural access FIRST
    const accessResult = await (0, pabandiTools_service_1.toolAccessOk)(def.name, req, {
        ownerUserId: req?.user?.id,
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
    const headers = {
        'Content-Type': 'application/json',
    };
    if (needsAuth) {
        const authHeader = req?.headers?.authorization;
        if (authHeader)
            headers['Authorization'] = authHeader;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
        const fetchOpts = { method, headers, signal: controller.signal };
        if (!['GET', 'HEAD'].includes(method) && args && Object.keys(args).length) {
            fetchOpts.body = JSON.stringify(args);
        }
        const resp = await fetch(url, fetchOpts);
        const text = await resp.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
        return { status: resp.status, ok: resp.ok, data, calledVia: 'mcp_proxy', endpoint: { method, path: ep.path, url } };
    }
    finally {
        clearTimeout(timer);
    }
}
// ── Per-tool proxy handlers ───────────────────────────────────────────────────
function buildPlatformToolDef(t) {
    const shortSlug = t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^pabandi_/, '');
    return {
        name: `pabandi_${shortSlug}`,
        description: (t.exclusiveNote ? t.description + ` [${t.access}] ${t.exclusiveNote}` : t.description) + ' This MCP tool makes a real HTTP call to the canonical Pabandi endpoint and returns the actual platform response.',
        inputSchema: {
            type: 'object',
            properties: Object.fromEntries(Object.entries(t.inputs).map(([k, desc]) => [k, { type: 'string', description: desc }])),
            required: Object.keys(t.inputs),
        },
        access: t.access,
        endpoints: t.endpoints,
        registryName: t.name,
        handler: async (args, req) => callPlatformHttp({ name: `pabandi_${shortSlug}`, registryName: t.name, access: t.access, endpoints: t.endpoints }, args, req),
    };
}
const PLATFORM_TOOL_DEFS = pabandiTools_service_1.pabandiToolsRegistry
    .filter((t) => t.category !== 'sdk')
    .map((t) => buildPlatformToolDef(t));
const OWNER_TOOL_DEFS = pabandiTools_service_1.pabandiToolsRegistry
    .filter((t) => t.access === 'owner' || t.access === 'verified' || t.access === 'exclusive')
    .map((t) => buildPlatformToolDef(t));
exports.TOOLS = [
    ...ENGINE_TOOLS,
    discoverPlatformTool,
    platformAccessTool,
    ...PLATFORM_TOOL_DEFS,
    ...OWNER_TOOL_DEFS,
];
// ── Dispatch ──────────────────────────────────────────────────────────────────
async function dispatch(method, params, id, req) {
    switch (method) {
        case 'initialize':
            return jsonRpc(id, {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            });
        case 'tools/list':
            return jsonRpc(id, { tools: exports.TOOLS });
        case 'tools/call': {
            const name = params?.name;
            const args = params?.arguments || {};
            try {
                const out = await callTool(name, args, req);
                return jsonRpc(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false });
            }
            catch (e) {
                return jsonRpc(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
            }
        }
        default:
            return jsonRpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
    }
}
async function callTool(name, args, req) {
    // Engine-backed tools
    if (ENGINE_TOOLS.some((t) => t.name === name)) {
        switch (name) {
            case 'pabandi_verify_passport': {
                if (!args.token)
                    throw new Error('token (base64 attestation) required');
                let att;
                try {
                    att = JSON.parse(Buffer.from(args.token, 'base64').toString('utf-8'));
                }
                catch {
                    throw new Error('token is not valid base64 JSON');
                }
                return ptp_spec_1.ptpEngine.verifyAgentPassport(att, args.need);
            }
            case 'pabandi_discover':
                return ptp_spec_1.ptpEngine.getDiscoveryDocument(`${process.env.BACKEND_URL || ''}`);
            case 'pabandi_get_ledger': {
                if (!args.idempotencyKey)
                    throw new Error('idempotencyKey required');
                const rec = await passportEconomy_service_1.passportEconomy.lookup(args.idempotencyKey);
                if (!rec)
                    throw new Error('no such issuance');
                return {
                    idempotencyKey: rec.idempotencyKey, ownerUserId: rec.ownerUserId, agentId: rec.agentId,
                    riskBand: rec.riskBand, feePab: rec.feePab, capabilities: rec.capabilities, chargedAt: rec.chargedAt,
                };
            }
            case 'pabandi_issue_passport': {
                const authUser = req?.user;
                if (!authUser?.id)
                    throw new Error('authentication required: pass a Bearer token for the passport owner');
                const { agentId, capabilities, idempotencyKey } = args;
                if (!agentId || !Array.isArray(capabilities) || !capabilities.length)
                    throw new Error('agentId and non-empty capabilities[] required');
                const user = await database_1.prisma.user.findUnique({ where: { id: authUser.id }, select: { trustScore: true } });
                if (!user)
                    throw new Error('owner user not found');
                const score = user.trustScore || 70;
                const band = ptp_spec_1.ptpEngine.scoreToRiskBand(score);
                const capCheck = (0, passportEconomy_service_1.validateCapabilities)(band, capabilities);
                if (!capCheck.ok)
                    throw new Error(`capability rejected: ${capCheck.reason}`);
                let charge;
                try {
                    charge = await passportEconomy_service_1.passportEconomy.chargeIssue({ ownerUserId: authUser.id, agentId, riskBand: band, capabilities, idempotencyKey });
                }
                catch (e) {
                    throw new Error(`issuance not recorded (not charged): ${e.message}`);
                }
                let velocity = { direction: 'STEADY', momentum: 0, confidence: 0.5 };
                try {
                    const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../services/trustFlux.service')));
                    const flux = await trustFluxService.computeTrustFlux(authUser.id);
                    velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
                }
                catch { /* default */ }
                const att = ptp_spec_1.ptpEngine.issueAgentPassport({ agentId, ownerUserId: authUser.id, capabilities, trustScore: score, velocity });
                return {
                    attestation: att,
                    token: Buffer.from(JSON.stringify(att)).toString('base64'),
                    economics: { feePab: charge.feePab, alreadyCharged: charge.alreadyCharged, idempotencyKey: charge.idempotencyKey, riskBand: band, ledgerId: charge.record?.id },
                };
            }
        }
    }
    // Platform discovery + access tools
    if (name === 'pabandi_discover_platform')
        return discoverPlatformTool.handler();
    if (name === 'pabandi_platform_access')
        return platformAccessTool.handler(args, req);
    // Curated platform tool — proxy the real HTTP call server-side with inline access enforcement
    const def = PLATFORM_TOOL_DEFS.find((t) => t.name === name) || OWNER_TOOL_DEFS.find((t) => t.name === name);
    if (!def)
        throw new Error(`Unknown MCP tool: ${name}. Run pabandi_discover_platform to see available tools.`);
    if (typeof def.handler === 'function') {
        return def.handler(args, req);
    }
    return callPlatformHttp(def, args, req);
}
/** Express handler for POST /mcp */
const mcpHandler = async (req, res) => {
    (0, auth_middleware_1.optionalAuthenticate)(req, res, async () => {
        const body = req.body;
        if (!body || body.jsonrpc !== '2.0')
            return res.status(400).json({ error: 'Invalid JSON-RPC 2.0 request' });
        if (body.method === 'notifications/initialized' || body.id === undefined)
            return res.status(202).end();
        try {
            const result = await dispatch(body.method, body.params || {}, body.id, req);
            res.setHeader('Content-Type', 'application/json');
            return res.json(result);
        }
        catch (e) {
            logger_1.logger.error('[MCP] dispatch error', e);
            return res.json(jsonRpc(body.id, undefined, { code: -32603, message: e.message }));
        }
    });
};
exports.mcpHandler = mcpHandler;
//# sourceMappingURL=pabandiMcpServer.js.map