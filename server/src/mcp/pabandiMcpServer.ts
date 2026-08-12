/**
 * pabandiMcpServer.ts — the Model Context Protocol (MCP) distribution layer that
 * makes the Pabandi Agent Capability Passport THE trust standard agents use.
 *
 * Implements the MCP JSON-RPC 2.0 wire protocol directly (no external SDK dep, so
 * it builds & runs anywhere) and exposes Pabandi's real trust engine as MCP tools:
 *
 *   pabandi_verify_passport  (public)  — verify any agent's passport + capability
 *   pabandi_discover         (public)  — discovery doc (verify URL + public key)
 *   pabandi_get_ledger       (public)  — audit a passport issuance charge
 *   pabandi_issue_passport   (owner)   — issue a scoped passport (metered $PAB)
 *
 * Mounted at POST /mcp (Streamable HTTP style). Any MCP client (Claude Desktop,
 * LangChain, AutoGPT, custom agents) can connect and verify/issue Pabandi passports.
 */
import { Request, Response } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { passportEconomy, validateCapabilities, PTPRiskBand } from '../services/passportEconomy.service';
import { PAB_FEE_PER_PASSPORT } from '../config/tokenomics';

const SERVER_NAME = 'pabandi-trust';
const SERVER_VERSION = '1.0.0';

// ── Tool definitions (MCP tools/list) ─────────────────────────────────────────
const TOOLS = [
  {
    name: 'pabandi_verify_passport',
    description: 'Verify a Pabandi Agent Capability Passport. Input a base64-encoded PTP attestation (optionally require a capability like "act:book"). Returns valid, granted capabilities, risk band, expiry. This is the core trust check any agent performs before trusting another agent or action.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Base64-encoded PTPAgentAttestation' },
        need: { type: 'string', description: 'Optional capability the agent must hold, e.g. "act:book" or "act:transfer:under:100USD"' },
      },
      required: ['token'],
    },
  },
  {
    name: 'pabandi_discover',
    description: 'Return the Pabandi Trust Protocol discovery document: the public verify endpoint URL and the protocol public key. Use this to bootstrap trust with Pabandi.',
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
    description: 'Issue a scoped Agent Capability Passport for one of your agents. Capabilities are validated against your trust band (foolproof: low-trust owners cannot get dangerous capabilities). Metered at PAB_FEE_PER_PASSPORT $PAB per issue (idempotent).',
    inputSchema: {
      type: 'object',
      properties: {
        ownerUserId: { type: 'string', description: 'Your Pabandi user id (the passport owner)' },
        agentId: { type: 'string', description: 'Unique id of the agent this passport is for' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'e.g. ["act:book","read"]' },
        idempotencyKey: { type: 'string', description: 'Optional; retries with the same key are not double-charged' },
      },
      required: ['ownerUserId', 'agentId', 'capabilities'],
    },
  },
];

function jsonRpc(id: any, result?: any, error?: any) {
  return { jsonrpc: '2.0', id, result, error };
}

async function dispatch(method: string, params: any, id: any): Promise<any> {
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
        const out = await callTool(name, args);
        return jsonRpc(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false });
      } catch (e: any) {
        return jsonRpc(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }

    default:
      return jsonRpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  }
}

async function callTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'pabandi_verify_passport': {
      if (!args.token) throw new Error('token (base64 attestation) required');
      let att: any;
      try { att = JSON.parse(Buffer.from(args.token, 'base64').toString('utf-8')); }
      catch { throw new Error('token is not valid base64 JSON'); }
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
      const { ownerUserId, agentId, capabilities, idempotencyKey } = args;
      if (!ownerUserId || !agentId || !Array.isArray(capabilities) || !capabilities.length) {
        throw new Error('ownerUserId, agentId, and non-empty capabilities[] required');
      }
      const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { trustScore: true } });
      const score = user?.trustScore || 70;
      const band = ptpEngine.scoreToRiskBand(score) as PTPRiskBand;
      const capCheck = validateCapabilities(band, capabilities);
      if (!capCheck.ok) throw new Error(`capability rejected: ${capCheck.reason}`);

      let charge;
      try { charge = await passportEconomy.chargeIssue({ ownerUserId, agentId, riskBand: band, capabilities, idempotencyKey }); }
      catch (e: any) { throw new Error(`issuance not recorded (not charged): ${e.message}`); }

      let velocity: any = { direction: 'STEADY', momentum: 0, confidence: 0.5 };
      try {
        const { trustFluxService } = await import('../services/trustFlux.service');
        const flux = await trustFluxService.computeTrustFlux(ownerUserId);
        velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
      } catch { /* default */ }

      const att = ptpEngine.issueAgentPassport({ agentId, ownerUserId, capabilities, trustScore: score, velocity });
      return {
        attestation: att,
        token: Buffer.from(JSON.stringify(att)).toString('base64'),
        economics: { feePab: charge.feePab, alreadyCharged: charge.alreadyCharged, idempotencyKey: charge.idempotencyKey, riskBand: band, ledgerId: charge.record?.id },
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Express handler for POST /mcp (MCP Streamable HTTP). */
export const mcpHandler = async (req: Request, res: Response) => {
  const body = req.body;
  // MCP Streamable HTTP may send a bare notification (no id) — ack with 202.
  if (!body || body.jsonrpc !== '2.0') {
    return res.status(400).json({ error: 'Invalid JSON-RPC 2.0 request' });
  }
  if (body.method === 'notifications/initialized' || body.id === undefined) {
    return res.status(202).end();
  }
  try {
    const result = await dispatch(body.method, body.params || {}, body.id);
    res.setHeader('Content-Type', 'application/json');
    return res.json(result);
  } catch (e: any) {
    logger.error('[MCP] dispatch error', e);
    return res.json(jsonRpc(body.id, undefined, { code: -32603, message: e.message }));
  }
};

export const pabandiMcpServer = { TOOLS, dispatch };
