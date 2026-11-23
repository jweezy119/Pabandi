import { AgentToolUser } from '../services/agentTools.service';
import { agentToolHandlers } from '../services/agentTools.handlers';
import { userHasScope } from '../services/agentScopes.service';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresAuth: boolean;
}

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const TOOLS: McpTool[] = [
  {
    name: 'pabandi_list_businesses',
    description: 'List active businesses for booking, with optional city, category, search, and cursor pagination.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100 },
        city: { type: 'string' },
        category: { type: 'string' },
        query: { type: 'string' },
        search: { type: 'string' },
        location: { type: 'string' },
      },
    },
  },
  {
    name: 'pabandi_get_business',
    description: 'Get one business by ID.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: { businessId: { type: 'string' } },
      required: ['businessId'],
    },
  },
  {
    name: 'pabandi_create_booking',
    description: 'Create a booking and its escrow record. Requires authentication.',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string' },
        slotStart: { type: 'string', format: 'date-time' },
        slotEnd: { type: 'string', format: 'date-time' },
        serviceType: { type: 'string' },
        numberOfGuests: { type: 'number' },
        depositAmount: { type: 'number' },
      },
      required: ['businessId', 'slotStart', 'slotEnd', 'serviceType'],
    },
  },
  {
    name: 'pabandi_get_booking',
    description: 'Get a booking with its escrow state.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'pabandi_mark_checkin',
    description: 'Mark a booking as attended. A verified check-in moves escrow to conditions_met; an overridden check-in opens a dispute.',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        locationVerified: { type: 'boolean' },
        distanceMeters: { type: 'number' },
        overrideReason: { type: 'string' },
      },
      required: ['bookingId', 'locationVerified'],
    },
  },
  {
    name: 'pabandi_release_escrow',
    description: 'Release a booking escrow to the business after verified completion. Requires business owner or admin.',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        reason: { type: 'string' },
        rail: { type: 'string', enum: ['solana_pay', 'x402', 'stripe_connect', 'circle', 'square', 'raast'] },
        txHash: { type: 'string' },
        receiptRef: { type: 'string' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'pabandi_refund_booking',
    description: 'Refund a booking deposit under policy. Requires client, business owner, or admin.',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'pabandi_verify_passport',
    description: 'Verify a Pabandi trust disclosure or passport signature.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: {
        credential: { type: 'string' },
        payload: { type: 'object' },
        audienceBusinessId: { type: 'string' },
        threshold: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
  },
  {
    name: 'pabandi_screen_wallet',
    description:
      'Screen a Solana wallet address for on-chain threat score, drainer activity, and sanctions risk via Webacy Risk Intelligence before funding escrow.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Base58-encoded Solana wallet address to screen.',
        },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'pabandi_request_payout',
    description: 'Request a USDC payout to a local rail, bank, or connected account. Requires authentication.',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        amountUsdc: { type: 'number', exclusiveMinimum: 0 },
        method: { type: 'string', enum: ['BANK', 'CONNECT', 'LOCAL', 'CASHAPP'] },
        destinationRef: { type: 'string' },
      },
      required: ['amountUsdc'],
    },
  },
  {
    name: 'pabandi_get_payout_history',
    description: 'Get the authenticated user\'s payout history.',
    requiresAuth: true,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pabandi_get_paid_proof',
    description: 'Get a public payment proof by its public ID.',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: { publicId: { type: 'string' } },
      required: ['publicId'],
    },
  },
  {
    name: 'pabandi_get_my_paid_proofs',
    description: 'Get the authenticated worker\'s payment proofs.',
    requiresAuth: true,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pabandi_get_identity',
    description: 'Return the authenticated agent or user identity.',
    requiresAuth: true,
    inputSchema: { type: 'object', properties: {} },
  },
];

export function initializeResult(clientProtocolVersion?: string) {
  return {
    protocolVersion: clientProtocolVersion || MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
    },
    serverInfo: {
      name: 'pabandi',
      version: '1.0.0',
      title: 'Pabandi Trust & Settlement',
    },
    instructions:
      'Pabandi is a booking, escrow, trust passport, and payout platform. ' +
      'Authenticate with Authorization: Bearer <JWT> or x-api-key: <pab_live_...>. ' +
      'Use pabandi_list_businesses and pabandi_get_business to find supply, ' +
      'pabandi_create_booking to reserve, pabandi_mark_checkin to record verified attendance, ' +
      'pabandi_release_escrow only after completion, pabandi_verify_passport to check behavioral trust, and pabandi_screen_wallet to check on-chain Solana wallet risk via Webacy. ' +
      'Money-moving tools require a Bearer JWT from /api/v1/auth/login. Never report simulated escrow as settled.',
  };
}

export async function callTool(name: string, args: Record<string, unknown>, user?: AgentToolUser) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
  }
  if (tool.requiresAuth && !user) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Authentication required. Send Authorization: Bearer <JWT> or x-api-key.' }) }],
      isError: true,
    };
  }
  if (user && !userHasScope(user, name)) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Agent key missing scope for ${name}` }) }],
      isError: true,
    };
  }

  try {
    const result = await agentToolHandlers[name]?.(args as any, user);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error?.message || 'Tool call failed' }) }],
      isError: true,
    };
  }
}

export async function handleRpc(payload: any, user?: AgentToolUser) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid JSON-RPC request' },
    };
  }

  const { jsonrpc, id, method, params } = payload as any;
  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC request' },
    };
  }

  switch (method) {
    case 'initialize':
      return { jsonrpc: '2.0', id, result: initializeResult(params?.protocolVersion) };
    case 'notifications/initialized':
    case 'initialized':
      return null;
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (typeof toolName !== 'string') {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'params.name is required' },
        };
      }
      const result = await callTool(toolName, args, user);
      return { jsonrpc: '2.0', id, result };
    }
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}
