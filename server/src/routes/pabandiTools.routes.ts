import { Router, Request, Response } from 'express';
import { pabandiToolsRegistry, pabandiPlatformDoc, accessLabel } from '../services/pabandiTools.service';
import { ptpEngine } from '../protocol/ptp.spec';

const router = Router();

// ── 1. /api/v1/pabandi/tools — machine-readable tool list (LLM/app) ────────────
router.get('/tools', async (_req: Request, res: Response) => {
  try {
    const doc = pabandiPlatformDoc();
    res.json({ success: true, data: doc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 2. /.well-known/pabandi/tools.json — registry-friendly copy ─────────────────
router.get('/.well-known/pabandi/tools.json', (_req: Request, res: Response) => {
  try {
    const doc = pabandiPlatformDoc();
    res.setHeader('Content-Type', 'application/json');
    return res.json(doc);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 3. /api/v1/pabandi/spec — aggregated OpenAPI 3.1 doc (app/SDK friendly) ─────
router.get('/spec', (_req: Request, res: Response) => {
  try {
    const doc = pabandiPlatformDoc();
    const servers = [process.env.BACKEND_URL || 'https://pabandi.onrender.com'];

    const paths: Record<string, any> = {};
    for (const t of doc.tools) {
      for (const ep of t.endpoints) {
        const p = ep.path;
        const method = ep.method.toLowerCase();
        (paths[p] as any)[method] = {
          summary: `${t.short} — ${t.short}`,
          description: t.description,
          operationId: `${t.category}:${t.name.replace(/:/g, '_')}`,
          tags: [t.category],
          responses: {
            '200': { description: 'Success. ' + t.output },
            '400': { description: 'Bad request.' },
            '403': { description: 'Access denied (see tool.access). ' + (t.exclusiveNote || '') },
            '401': { description: 'Not authenticated where required.' },
            '500': { description: 'Internal error.' },
          },
          parameters: Object.entries(t.inputs).map(([k, desc]) => ({
            name: k,
            in: 'query',
            required: false,
            description: desc,
            schema: { type: 'string' },
          })),
        };
        if (ep.method.toUpperCase() === 'POST') {
          (paths[p] as any)[method].requestBody = {
            required: false,
            content: { 'application/json': { schema: { type: 'object', properties: Object.fromEntries(Object.entries(t.inputs).map(([k, desc]) => [k, { type: 'string', description: desc }])) } } },
          };
        }
      }
    }
    // PTP attestation endpoints (verifiable trust) — add explicitly so the spec is honest.
    paths['/api/v1/agent-passport/verify'] = {
      get: {
        summary: 'Verify a Pabandi PTP attestation (public, no-auth)',
        description: 'Verify any Pabandi attestation offline: re-executes HMAC-SHA512 over a fixed field subset, returns valid + verified claims. All portals/apps/agents gate on this.',
        operationId: 'ptp:verify',
        tags: ['trust'],
        parameters: [
          { name: 'token', in: 'query', required: true, description: 'base64-encoded PTPAttestation', schema: { type: 'string' } },
          { name: 'need', in: 'query', required: false, description: 'capability to require (e.g. act:book)', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'PTPVeificationResult {valid, expired, signatureValid, attestation, verifiedAt}' }, '400': { description: 'Malformed token.' } },
      },
    };
    if (!paths['/api/v1/agent-passport/issue']) {
      paths['/api/v1/agent-passport/issue'] = {
        post: {
          summary: 'Issue a scoped Agent Capability Passport (owner/auth)',
          description: 'Issue a signed, portable, metered passport for an agent. Capabilities validated against the owner\'s trust band (foolproof).',
          operationId: 'ptp:issue',
          tags: ['trust'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { agentId: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } }, idempotencyKey: { type: 'string' } } } } } },
          responses: { '200': { description: 'Attestation + economics.' }, '402': { description: 'Issuance not recorded (not charged).' } },
        },
      };
    }
    if (!paths['/mcp']) {
      paths['/mcp'] = {
        post: {
          summary: 'MCP JSON-RPC endpoint (LLM/agent access)',
          description: 'Streamable HTTP MCP endpoint. Connect any MCP client (Claude Desktop, LangChain, AutoGPT) to verify/issue Pabandi passports and discover the platform via the pabandi_discover_platform tool.',
          operationId: 'mcp:discover',
          tags: ['sdk'],
          responses: { '200': { description: 'MCP JSON-RPC response.' }, '400': { description: 'Invalid JSON-RPC.' } },
        },
      };
    }

    const spec: any = {
      openapi: '3.1.0',
      info: {
        title: 'Pabandi Platform API',
        version: doc.version,
        description: doc.description + '\n\n' + 'Access tiers: ' + JSON.stringify(doc.accessTiers, null, 2) + '\n\n' + 'Portable trust: ' + JSON.stringify(doc.ptp, null, 2),
        contact: { name: 'Pabandi', email: 'jay@pabandi.com' },
      },
      servers: servers.map((s) => ({ url: s })),
      tags: [...new Set(doc.tools.map((t: any) => t.category).concat(['trust', 'sdk']))] as string[],
      paths,
      components: {
        schemas: {
          PabandiTool: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              short: { type: 'string' },
              description: { type: 'string' },
              access: { type: 'string', enum: ['public', 'owner', 'verified', 'exclusive'] },
              accessLabel: { type: 'string' },
              category: { type: 'string' },
              endpoints: { type: 'array', items: { type: 'object', properties: { method: { type: 'string' }, path: { type: 'string' }, note: { type: 'string' } } } },
              inputs: { type: 'object' },
              output: { type: 'string' },
              exclusiveNote: { type: 'string' },
              attestation: { type: 'string' },
            },
          },
          PabandiPlatformDoc: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              tools: { type: 'array', items: { $ref: '#/components/schemas/PabandiTool' } },
              accessTiers: { type: 'object' },
              specUrl: { type: 'string' },
              toolsUrl: { type: 'string' },
              ptp: { type: 'object' },
              mcp: { type: 'object' },
              sdk: { type: 'object' },
              status: { type: 'object' },
            },
          },
        },
      },
    };
    res.setHeader('Content-Type', 'application/json');
    return res.json(spec);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
